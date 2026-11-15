#!/usr/bin/env node
/**
 * [INPUT]: 显式main引用、同一套黑盒用例、Playwright/PNGJS与当前候选renderer。
 * [OUTPUT]: 仓库外的基线来源、截图、状态轨迹和差异报告；差异或基线断言失败返回非零。
 * [POS]: 独立实现的对照门，不改基线、不输出构建物、不接真实Tauri写入API。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const { createDriver } = require('./driver');
const { cases } = require('./cases');
const repo = path.resolve(__dirname,'../..');
function arg(name, fallback) { const i=process.argv.indexOf(name); return i<0?fallback:process.argv[i+1]; }
const reference = execFileSync('git',['rev-parse',`${arg('--reference','origin/main')}^{commit}`],{cwd:repo,encoding:'utf8'}).trim();
const output = path.resolve(arg('--output',path.join(os.tmpdir(),`cavalry-ui-parity-${Date.now()}`)));
assert.ok(output !== repo && !output.startsWith(repo+path.sep),'Evidence must stay outside product sources');
fs.mkdirSync(output,{recursive:true});
const filters = arg('--cases','').split(',').filter(Boolean);
assert.ok(filters.every(name=>cases.some(([known])=>known===name)),'Unknown test case');
const locales = arg('--locales','en,zh-Hans,zh-Hant,ja_JP').split(',');
assert.ok(locales.every(locale=>['en','zh-Hans','zh-Hant','ja_JP'].includes(locale)),'Unknown UI locale');
const variants = arg('--mode','both')==='reference'?['reference']:['reference','candidate'];
if(variants.length>1&&!process.argv.includes('--self-reference'))execFileSync(process.execPath,[path.join(repo,'tools/build_ui_sdk.js')],{cwd:repo});
const candidateFiles=[...fs.readdirSync(path.join(repo,'renderer')).filter(name=>!name.endsWith('.md')).map(name=>'renderer/'+name),
  ...fs.readdirSync(path.join(repo,'tools')).filter(name=>/^ui_review.*\.js$/.test(name)).map(name=>'tools/'+name),
  'package.json','package-lock.json','src-tauri/tauri.conf.json','tools/build_ui_sdk.js',
  'tools/ui_sdk_primitives.mjs','tools/ui_sdk_entry.mjs','tools/ui_sdk_components.json',
  'tools/ui-parity/run.js','tools/ui-parity/driver.js','tools/ui-parity/cases.js'];
const report = { reference, candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  candidateSource:repo,candidateSourceHashes:Object.fromEntries(candidateFiles.filter(name=>fs.statSync(path.join(repo,name)).isFile()).map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,name))).digest('hex')])),
  selfReference:process.argv.includes('--self-reference'),probe:arg('--probe',null),scope:{filters,locales},sdkCoverage:{},output,cases:[],comparisons:[],differences:[],environment:{node:process.version,playwright:require('playwright/package.json').version,platform:os.platform(),architecture:os.arch()} };
function snapshotMain() {
  const root=path.join(output,'main-source'); fs.mkdirSync(root,{recursive:true});
  const names=execFileSync('git',['ls-tree','-r','--name-only',reference,'renderer','tools'],{cwd:repo,encoding:'utf8'}).trim().split('\n')
    .filter(n=>n.startsWith('renderer/')||/^tools\/ui_review.*\.js$/.test(n));
  for(const name of names) { const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,execFileSync('git',['show',`${reference}:${name}`],{cwd:repo,maxBuffer:16*1024*1024})); }
  return root;
}
function server(root) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['-e',`const s=require(process.argv[1]).createUiReviewServer();s.listen(0,'127.0.0.1',()=>console.log(s.address().port));`,path.join(root,'tools/ui_review_server.js')],{stdio:['ignore','pipe','pipe']});
    let log='';child.stderr.on('data',b=>log+=b);child.on('error',reject);child.once('exit',code=>{if(code)reject(new Error(log))});
    child.stdout.once('data',b=>resolve({child,origin:`http://127.0.0.1:${String(b).trim()}`}));
  });
}
function pixelDiff(a,b,dest) {
  const left=PNG.sync.read(fs.readFileSync(a)),right=PNG.sync.read(fs.readFileSync(b));
  assert.equal(left.width,right.width);assert.equal(left.height,right.height);
  const diff=new PNG({width:left.width,height:left.height});let different=0,max=0;
  for(let i=0;i<left.data.length;i+=4){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(left.data[i+c]-right.data[i+c]);delta=Math.max(delta,d);diff.data[i+c]=d;}diff.data[i+3]=255;max=Math.max(max,delta);if(delta>0)different++;}
  if(different)fs.writeFileSync(dest,PNG.sync.write(diff));
  return {differentPixels:different,maxChannelDelta:max};
}
let browser;const servers=[];
(async()=>{
  const baseline=snapshotMain();servers.push(await server(baseline));if(variants.length>1)servers.push(await server(report.selfReference?baseline:repo));
  browser=await chromium.launch();
  report.environment.browserVersion=browser.version();
  for(const locale of locales)for(const [name,run] of cases.filter(([name])=>!filters.length||filters.includes(name))) {
    const pair=[];
    for(const [index,variant]of variants.entries()) {
      const dir=path.join(output,variant,locale,name);fs.mkdirSync(dir,{recursive:true});
      const context=await browser.newContext({viewport:{width:400,height:504},deviceScaleFactor:2,locale:'en-US',colorScheme:'light'});
      if(variant==='candidate'&&report.probe==='visual')await context.route('**/renderer/styles.css',async route=>{
        const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\n.button { font-size: 19px !important }'});
      });
      const driver=await createDriver(context,servers[index].origin,locale,dir,variant==='candidate'?report.probe:null);
      const result={variant,locale,name,checkpoints:driver.checkpoints,errors:driver.errors};
      try {await run(driver);assert.deepEqual(driver.errors,[]);}catch(error){result.failure=error.stack;await driver.page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});}
      report.cases.push(result);pair.push(result);fs.writeFileSync(path.join(dir,'trace.json'),JSON.stringify(result,null,2));await context.close();
      if(variant==='candidate'&&!report.selfReference)for(const [name,seen]of Object.entries(driver.coverage))report.sdkCoverage[name]=report.sdkCoverage[name]||seen;
      process.stdout.write(`${variant} ${locale}/${name}: ${result.failure?'FAIL':`PASS (${result.checkpoints.length})`}\n`);
    }
    if(pair.length===2&&!pair.some(r=>r.failure)) {
      const [base,candidate]=pair;
      for(const [i,expected]of base.checkpoints.entries()) {
        const actual=candidate.checkpoints[i],difference={locale,case:name,checkpoint:expected.name};let failed=false;
        try {assert.deepEqual(actual.observed,expected.observed);}catch{difference.expected=expected.observed;difference.actual=actual.observed;failed=true;}
        try {assert.deepEqual(actual.geometry,expected.geometry);}catch{difference.geometry={expected:expected.geometry,actual:actual.geometry};failed=true;}
        if(expected.file&&actual?.file) {
          const pixels=pixelDiff(path.join(output,'reference',locale,name,expected.file),path.join(output,'candidate',locale,name,actual.file),path.join(output,'candidate',locale,name,`diff-${actual.file}`));
          report.comparisons.push({...difference,pixels});
          if(pixels.differentPixels){difference.pixels=pixels;failed=true;}
        }
        if(failed)report.differences.push(difference);
      }
    }
  }
  const failures=report.cases.filter(r=>r.failure).length;
  const missing=!filters.length&&!report.selfReference&&variants.length>1?Object.entries(report.sdkCoverage).filter(([,seen])=>!seen).map(([name])=>name):[];
  const changed=Object.entries(report.candidateSourceHashes).filter(([name,digest])=>crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,name))).digest('hex')!==digest).map(([name])=>name);
  report.sourceChangedDuringRun=changed;report.missingSdkComponents=missing;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({reference,tests:report.cases.length,failures,differences:report.differences.length,output}));
  process.exitCode=failures||report.differences.length||missing.length||changed.length?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();for(const {child}of servers)child.kill();});
