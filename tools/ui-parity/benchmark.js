#!/usr/bin/env node
/**
 * [INPUT]: Explicit Git references or SHA-bound working-tree candidate, identical bridge/CSP, pinned Playwright and real clocks.
 * [OUTPUT]: Raw paired browser samples, DOM-work counts, GC/listener retention and byte/maintenance inventories outside the repo.
 * [POS]: Read-only UI SDK comparison; exported renderers are test inputs, never production build roots.
 * [PROTOCOL]: Update this header and CLAUDE.md when changing the contract.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium,webkit}=require('playwright');
const {fixtureSource}=require('../ui_review_server');
const root=path.resolve(__dirname,'../..');
const arg=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
const git=(...args)=>execFileSync('/usr/bin/git',args,{cwd:root,maxBuffer:32*1024*1024});
const workingTree=process.argv.includes('--working-tree');
const batchBefore=process.argv.includes('--batch-before');
const enforceBudgets=process.argv.includes('--enforce-after-budgets');
const refs={before:git('rev-parse',arg('--before','6988f7c')).toString().trim(),after:git('rev-parse',arg('--after','origin/main')).toString().trim()};
const out=path.resolve(arg('--output',path.join(os.tmpdir(),'cavalry-sdk-perf-'+Date.now())));
assert.ok(!out.startsWith(root+path.sep)&&out!==root,'Use an external evidence directory');fs.mkdirSync(out,{recursive:true});
const samples=Number(arg('--samples','32')),cycles=Number(arg('--cycles','200'));
assert.ok(Number.isInteger(samples)&&samples>=4&&Number.isInteger(cycles)&&cycles>=12&&cycles%4===0);
const engines=arg('--engines','chromium,webkit').split(',');
const phase=arg('--phase','all');assert.ok(['all','startup','details','work','leaks'].includes(phase));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inventories={};
for(const [variant,ref]of Object.entries(refs)){
 const fromWorkingTree=workingTree&&variant==='after';
 const names=git(...(fromWorkingTree?['ls-files','--cached','--others','--exclude-standard','renderer']:['ls-tree','-r','--name-only',ref,'renderer'])).toString().trim().split('\n').sort();
 const files={};for(const name of names){let b=fromWorkingTree?fs.readFileSync(path.join(root,name)):git('show',ref+':'+name);if(batchBefore&&variant==='before'&&name==='renderer/operation-log.js'){const original='function syncAfterLayout() {\n      scrollToLatest();';assert.ok(b.toString().includes(original),'before source must have known synchronous log measurement');b=Buffer.from(b.toString().replace(original,'function syncAfterLayout() {'));}const dest=path.join(out,variant,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);files[name]={bytes:b.length,lines:b.toString().split('\n').length-1,sha256:sha(b)};}
 const types=['.js','.css','.html'];const source=names.filter(n=>types.includes(path.extname(n)));
 const joined=Buffer.concat(source.map(n=>fs.readFileSync(path.join(out,variant,n))));
 inventories[variant]={sourceKind:fromWorkingTree?'working-tree (ref is base only)':batchBefore&&variant==='before'?'git-commit + generic rAF batching':'git-commit',files,productionSourceLines:source.reduce((n,p)=>n+files[p].lines,0),sourceFiles:source.length,
  rendererBytes:names.reduce((n,p)=>n+files[p].bytes,0),codeBytes:joined.length,gzipCodeBytes:zlib.gzipSync(joined,{level:9}).length,
  ownCodeLines:source.filter(n=>n!=='renderer/ui-sdk.js').reduce((n,p)=>n+files[p].lines,0)};
}
const csp=JSON.parse(fs.readFileSync(path.join(root,'src-tauri/tauri.conf.json'))).app.security.csp;
const buildSourceHashes=Object.fromEntries(['tools/ui_sdk_entry.mjs','tools/build_ui_sdk.js','tools/ui_sdk_components.json','package.json','package-lock.json'].map(name=>[name,sha(fs.readFileSync(path.join(root,name)))]));
if(workingTree)fs.writeFileSync(path.join(out,'candidate.patch'),git('diff','--binary','HEAD','--','renderer','tools/ui_sdk_primitives.mjs','tools/ui_sdk_entry.mjs','tools/build_ui_sdk.js','tools/ui_sdk_components.json','package.json','package-lock.json'));
const fixture=fixtureSource();
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');let body,type;
 if(url.pathname==='/fixture.js'){body=fixture;type='text/javascript';}
 else if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 else{
  const m=url.pathname.match(/^\/(before|after)\/(app|renderer\/.+)$/);if(!m){res.writeHead(404);res.end();return;}
  const name=m[2]==='app'?'renderer/index.html':decodeURIComponent(m[2]);
  const file=path.resolve(out,m[1],name);if(!file.startsWith(path.join(out,m[1],'renderer')+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  body=fs.readFileSync(file);type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream';
  if(m[2]==='app')body=body.toString().replace(/((?:src|href)=")\.\//g,'$1/'+m[1]+'/renderer/').replace('<script src="/'+m[1]+'/renderer/tauri-bridge.js"></script>','<script src="/fixture.js"></script><script src="/'+m[1]+'/renderer/tauri-bridge.js"></script>');
 }
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':csp});res.end(body);
});
// No Playwright Clock, altered CSS, CPU throttling or animation fast-forwarding.
function probe({count=false}={}){
 const p=window.__uiPerf={readyMs:null,readyPaintMs:null,longTasks:[],counts:{}};
 const frame=window.requestAnimationFrame.bind(window);
 p.twoFrames=()=>new Promise(resolve=>frame(()=>frame(resolve)));
 const observer=new MutationObserver(()=>{const e=document.querySelector('#languageSelectTrigger');if(p.readyMs===null&&e&&!e.disabled){p.readyMs=performance.now();p.twoFrames().then(()=>p.readyPaintMs=performance.now());}});
 observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
 try{new PerformanceObserver(list=>p.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});}catch{}
 if(count){
  new MutationObserver(records=>{p.counts.attributeMutations=(p.counts.attributeMutations||0)+records.length;}).observe(document,{subtree:true,attributes:true});
  for(const [target,name]of [[Node.prototype,'compareDocumentPosition'],[TreeWalker.prototype,'nextNode'],[Element.prototype,'getAttribute'],[Element.prototype,'setAttribute'],[Element.prototype,'removeAttribute'],[Element.prototype,'getBoundingClientRect'],[window,'getComputedStyle']]){
   const original=target[name];target[name]=function(...args){p.counts[name]=(p.counts[name]||0)+1;return original.apply(this,args);};
  }
  for(const [target,names]of [[HTMLElement.prototype,['offsetWidth','offsetHeight','offsetTop','offsetLeft']],[Element.prototype,['clientWidth','clientHeight','scrollWidth','scrollHeight','scrollTop','scrollLeft']]])for(const name of names){
   const descriptor=Object.getOwnPropertyDescriptor(target,name);if(!descriptor?.get)continue;
   Object.defineProperty(target,name,{...descriptor,get(){p.counts[name]=(p.counts[name]||0)+1;return descriptor.get.call(this);}});
  }
 }
 p.arm=(type,expected)=>{
  p.pending=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Input observation timed out')),3000);
   window.addEventListener(type,event=>{
    const start=performance.now();p.twoFrames().then(()=>{
     clearTimeout(timer);const open=document.querySelector('#languageSelectTrigger').getAttribute('aria-expanded');
     if(expected!==undefined&&open!==expected){reject(new Error('Wrong select state '+open));return;}
     resolve({ms:performance.now()-start,trusted:event.isTrusted});
    });
   },{capture:true,once:true});
  });
 };
 p.ready=async()=>{const deadline=performance.now()+15000;while(p.readyPaintMs===null){if(performance.now()>deadline)throw new Error('Ready timeout '+JSON.stringify({ready:p.readyMs,visibility:document.visibilityState,disabled:document.querySelector('#languageSelectTrigger')?.disabled,body:document.body?.innerText.slice(0,300)}));await new Promise(r=>setTimeout(r,5));}await document.fonts.ready;return {readyMs:p.readyMs,readyPaintMs:p.readyPaintMs,
  domContentLoadedMs:performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd||null,
  fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime||null,
  domElements:document.querySelectorAll('*').length,requests:performance.getEntriesByType('resource').map(r=>({name:r.name,bytes:r.decodedBodySize,duration:r.duration})),longTasks:p.longTasks};};
}
const report={schemaVersion:1,kind:'UiSdkBeforeAfterBenchmark',createdAt:new Date().toISOString(),refs,
 environment:{node:process.version,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,memoryBytes:os.totalmem(),os:execFileSync('sw_vers').toString(),loadStart:os.loadavg()},
 method:{samples,cycles,order:'AB/BA paired, four locales rotated',clock:'real',viewport:{width:400,height:504},deviceScaleFactor:2,cpuThrottle:1,
  startup:'fresh browser context; browser/OS file caches already warm; two rAF paint opportunity after actionable controls, not OS display presentation',
  interaction:'trusted Playwright keyboard input to second rAF; frame-quantized, not a sub-frame CPU timing',
  work:'separate instrumented pass; same DOM hooks as official count gates',
  leak:`separate Chromium CDP pass; ${cycles} select/Toast cycles, 1s quiet + two frames + GC; global listeners and detached HTMLElement counts; no mount/unmount coverage`},
 official:{repository:'https://github.com/vercel-labs/ui',snapshot:'98ba9fd019274efae63fae08eb56da02453b4873',countGate:'tests/perf/init.ts',leakGate:'tests/perf/leaks.ts',size:'gzip level9 (same compression level as official size script)'},
 harnessSha256:sha(fs.readFileSync(__filename)),phase,workingTree,batchBefore,enforceBudgets,budgets:{maxStyleRecalcs100Rows:20},buildSourceHashes,fixtureSha256:sha(fixture),cspSha256:sha(csp),inventories,runs:[],interactions:[],work:[],leaks:[],details:[],errors:[]};
fs.copyFileSync(__filename,path.join(out,'harness.js'));
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
async function ready(page,origin,variant,locale){
 await page.goto(`${origin}/${variant}/app?scenario=nativeOfficialDefaultEnglish&locale=${locale}`,{waitUntil:'load'});
 return page.evaluate(()=>window.__uiPerf.ready());
}
async function input(page,key,expected){
 await page.evaluate(expected=>window.__uiPerf.arm('keydown',expected),expected);await page.keyboard.press(key);
 return page.evaluate(()=>window.__uiPerf.pending);
}
async function listenerCounts(cdp){
 const counts={};for(const target of ['window','document']){const {result}=await cdp.send('Runtime.evaluate',{expression:target,objectGroup:'listeners'});const r=await cdp.send('DOMDebugger.getEventListeners',{objectId:result.objectId});counts[target]=r.listeners.reduce((n,x)=>(n[x.type]=(n[x.type]||0)+1,n),{});}
 await cdp.send('Runtime.releaseObjectGroup',{objectGroup:'listeners'});return counts;
}
async function snapshot(page,cdp){
 await page.waitForTimeout(1000);await page.evaluate(()=>window.__uiPerf.twoFrames());await cdp.send('HeapProfiler.collectGarbage');
 const listeners=await listenerCounts(cdp);const heap=await cdp.send('Runtime.getHeapUsage');const dom=await cdp.send('Memory.getDOMCounters');
 const {result}=await cdp.send('Runtime.evaluate',{expression:'HTMLElement.prototype',objectGroup:'detached'});
 const {objects}=await cdp.send('Runtime.queryObjects',{prototypeObjectId:result.objectId,objectGroup:'detached'});
 const r=await cdp.send('Runtime.callFunctionOn',{objectId:objects.objectId,functionDeclaration:'function(){return this.filter(el=>{try{return !el.isConnected&&el.nodeType===1}catch{return false}}).length}',returnByValue:true});
 await cdp.send('Runtime.releaseObjectGroup',{objectGroup:'detached'});
 return {heapBytes:heap.usedSize,dom,globalListeners:listeners,detachedElements:r.result.value};
}
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 for(const engine of engines){
  assert.ok(['chromium','webkit'].includes(engine));console.log('start '+engine);browser=await({chromium,webkit}[engine]).launch();report.environment[engine]=browser.version();save();
  // Warm both variants without retaining these pages in measured samples.
  for(const variant of ['before','after']){const c=await browser.newContext({viewport:{width:400,height:504},deviceScaleFactor:2});await c.addInitScript(probe);const p=await c.newPage();await ready(p,origin,variant,'en');await c.close();}
  if(['all','startup'].includes(phase))for(let pair=0;pair<samples;pair++){
   const locale=['en','zh-Hans','zh-Hant','ja_JP'][pair%4];
   for(const variant of pair%2?['after','before']:['before','after']){
    const context=await browser.newContext({viewport:{width:400,height:504},deviceScaleFactor:2,colorScheme:'light',locale:'en-US'});await context.addInitScript(probe);
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const cold=await ready(page,origin,variant,locale);report.runs.push({engine,variant,pair,locale,phase:'fresh-context',...cold});
    await page.reload({waitUntil:'load'});report.runs.push({engine,variant,pair,locale,phase:'same-context-reload',...await page.evaluate(()=>window.__uiPerf.ready())});
    await page.locator('#languageSelectTrigger').focus();
    const open=await input(page,'Space','true');const move=await input(page,'ArrowDown','true');const close=await input(page,'Escape','false');
    report.interactions.push({engine,variant,pair,locale,open,move,close});
    assert.deepEqual(errors,[]);await context.close();
   }
   if(pair%8===7){console.log(engine+' startup/input pairs '+(pair+1)+'/'+samples);save();}
  }
  // Exact work counts are not mixed into timing samples.
  if(['all','work'].includes(phase))for(const variant of ['before','after'])for(const n of [4,10,500]){
   const context=await browser.newContext({viewport:{width:400,height:504},deviceScaleFactor:2});await context.addInitScript(probe,{count:true});const page=await context.newPage();await ready(page,origin,variant,'en');
   await page.evaluate(n=>{languageSelectControl.setOptions(Array.from({length:n},(_,i)=>({value:'v'+i,label:'Option '+i})));window.__uiPerf.counts={};},n);
   await page.locator('#languageSelectTrigger').focus();await input(page,'Space','true');await page.evaluate(()=>window.__uiPerf.counts={});
   for(let i=0;i<10;i++){await page.keyboard.press('ArrowDown');await page.waitForTimeout(50);}
   report.work.push({engine,variant,items:n,action:'10 ArrowDown, 50ms gaps',counts:await page.evaluate(()=>window.__uiPerf.counts)});
   await input(page,'Escape','false');await context.close();
  }
  if(['all','leaks'].includes(phase)&&engine==='chromium')for(const variant of ['before','after']){
   const context=await browser.newContext({viewport:{width:400,height:504},deviceScaleFactor:2});await context.addInitScript(probe);const page=await context.newPage();await ready(page,origin,variant,'en');const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
   // Prime dynamic paths, then GC, before taking retained-resource baselines.
   await page.locator('#languageSelectTrigger').focus();await input(page,'Space','true');await input(page,'Escape','false');
   await page.evaluate(()=>{for(let i=0;i<10;i++){const id=toastControl.show({title:'Warm '+i,type:'loading'});toastControl.close(id);}});
   await page.waitForTimeout(700);
   const before=await snapshot(page,cdp),metricsBefore=await cdp.send('Performance.getMetrics'),checkpoints=[];
   for(let batch=0;batch<4;batch++){
    await page.evaluate(count=>{for(let i=0;i<count;i++){const t=document.querySelector('#languageSelectTrigger');t.click();t.click();const id=toastControl.show({title:'Stress '+i,type:'loading'});toastControl.close(id);}operationLog.idle();},cycles/4);
    await page.waitForTimeout(700);
    if(phase==='leaks')checkpoints.push({cycles:(batch+1)*cycles/4,...await snapshot(page,cdp)});
   }
   const after=await snapshot(page,cdp),metricsAfter=await cdp.send('Performance.getMetrics');
   const delta={};for(const m of metricsAfter.metrics){const first=metricsBefore.metrics.find(x=>x.name===m.name);if(first)delta[m.name]=m.value-first.value;}
   let settled=null;if(phase==='leaks'){await page.waitForTimeout(10000);settled=await snapshot(page,cdp);}
   report.leaks.push({variant,cycles,before,after,checkpoints,settled,heapGrowthBytes:after.heapBytes-before.heapBytes,metricsDelta:delta,remainingToasts:await page.locator('.toast').count()});
   await context.close();
  }
  // Public API and trusted input paths; real animation/intent delays stay enabled.
  // CDP CPU counters are recorded in this separate pass, never in startup samples.
  if(['all','details'].includes(phase))for(let pair=0;pair<samples;pair++)for(const variant of pair%2?['after','before']:['before','after']){
   const context=await browser.newContext({viewport:{width:400,height:504},deviceScaleFactor:2});await context.addInitScript(probe);
   const page=await context.newPage();await ready(page,origin,variant,'en');
   const cdp=engine==='chromium'?await context.newCDPSession(page):null;if(cdp)await cdp.send('Performance.enable');
   const metrics=async()=>cdp?Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value])):{};
   async function measure(action,selector,expected,trigger){
    const before=await metrics();
    await page.evaluate(({selector,expected,event})=>{
     const p=window.__uiPerf;
     p.detailPending=new Promise((resolve,reject)=>{
      let start;const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('Detail timeout '+selector));},60000);
      const check=()=>{if(start===undefined)return;const e=document.querySelector(selector);if(!e||!(expected==='open'?(e.open||e.hasAttribute('data-open')):expected==='closed'?!(e.open||e.hasAttribute('data-open')):expected==='tooltip'?(e.hasAttribute('data-open')||e.dataset.state==='open'):expected==='toast'?true:e.children.length===Number(expected)))return;
       observer.disconnect();p.twoFrames().then(()=>{clearTimeout(timeout);resolve({ms:performance.now()-start});});};
      const observer=new MutationObserver(check);observer.observe(document,{subtree:true,childList:true,attributes:true});
      if(event)window.addEventListener(event,e=>{start=performance.now();p.detailTrusted=e.isTrusted;queueMicrotask(check);},{once:true,capture:true});
      else{start=performance.now();p.detailTrusted=false;}
     });
    },{selector,expected,event:trigger.event});
    await trigger.run();const result=await page.evaluate(async()=>({...await window.__uiPerf.detailPending,trusted:window.__uiPerf.detailTrusted}));
    const after=await metrics();const cpu={};for(const name of ['ScriptDuration','LayoutDuration','RecalcStyleDuration','TaskDuration'])if(name in before)cpu[name+'Ms']=(after[name]-before[name])*1000;
    for(const name of ['RecalcStyleCount','LayoutCount'])if(name in before)cpu[name]=after[name]-before[name];
    report.details.push({engine,variant,pair,action,...result,cpu});
    if(enforceBudgets&&engine==='chromium'&&variant==='after'&&action==='log-batch-100')assert.ok(cpu.RecalcStyleCount<=report.budgets.maxStyleRecalcs100Rows,`100-row batch forced ${cpu.RecalcStyleCount} style recalculations; budget ${report.budgets.maxStyleRecalcs100Rows}`);
   }
   // Readonly fixture: translated enables Restore, but this only opens/cancels its dialog.
   await page.goto(`${origin}/${variant}/app?scenario=translated&locale=en`,{waitUntil:'load'});await page.evaluate(()=>window.__uiPerf.ready());
   await page.locator('#restoreButton').focus();
   await measure('dialog-open','#modalBackdrop','open',{event:'keydown',run:()=>page.keyboard.press('Enter')});
   await page.locator('#modalSecondaryButton').focus();
   await measure('dialog-cancel','#modalBackdrop','closed',{event:'keydown',run:()=>page.keyboard.press('Enter')});
   await page.goto(`${origin}/${variant}/app?scenario=windowsClean&preview=update&locale=en`,{waitUntil:'load'});await page.evaluate(()=>window.__uiPerf.ready());
   await page.mouse.move(200,400);await page.waitForTimeout(250);
   await measure('tooltip-hover-including-intent-delay','#updateTooltip','tooltip',{event:'pointerover',run:()=>page.locator('#updateButton').hover()});
   await page.mouse.move(200,400);await page.waitForTimeout(250);
   await measure('toast-public-api','.toast','toast',{run:()=>page.evaluate(()=>{window.__detailToast=toastControl.show({title:'Benchmark notification',type:'loading'});})});
   await page.evaluate(()=>toastControl.close(window.__detailToast));await page.waitForTimeout(500);
   for(const n of [10,100]){
    await page.evaluate(()=>operationLog.start({intro:''}));
    await measure('log-batch-'+n,'#statusText',String(n),{run:()=>page.evaluate(n=>{for(let i=0;i<n;i++)operationLog.upsert({id:'bench-'+i,title:'Completed operation '+i,state:'completed',urgent:true});},n)});
    await page.evaluate(()=>operationLog.idle());
   }
   assert.equal(await page.evaluate(()=>Boolean(document.querySelector('#modalBackdrop').open)),false);await context.close();
   if(variant===(pair%2?'before':'after')&&pair%8===7){console.log(engine+' detail pairs '+(pair+1)+'/'+samples);save();}
  }
  await browser.close();browser=null;save();
 }
 if(workingTree){
  for(const [name,meta]of Object.entries(inventories.after.files))assert.equal(sha(fs.readFileSync(path.join(root,name))),meta.sha256,'Candidate changed during run: '+name);
  for(const [name,digest]of Object.entries(buildSourceHashes))assert.equal(sha(fs.readFileSync(path.join(root,name))),digest,'Build source changed during run: '+name);
 }
 report.environment.loadEnd=os.loadavg();save();console.log(JSON.stringify({output:out,startupSamples:report.runs.length,interactionSamples:report.interactions.length,errors:report.errors.length}));
})().catch(error=>{report.errors.push(error.stack);save();console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
