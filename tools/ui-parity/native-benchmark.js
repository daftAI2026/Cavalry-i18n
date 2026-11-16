#!/usr/bin/env node
/**
 * [INPUT]: Two explicit benchmark-only .app bundles with identical localhost readiness probes; provenance inputs.json.
 * [OUTPUT]: Paired real macOS launch-to-ready samples and host-only physical footprint outside the repository.
 * [POS]: Readonly native companion to benchmark.js; never builds from exported parity folders or invokes Apply/Restore.
 * [PROTOCOL]: Update this header and CLAUDE.md when changing the contract.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i<0?d:process.argv[i+1];};
const dir=path.resolve(arg('--inputs',''));assert.ok(fs.existsSync(path.join(dir,'inputs.json')),'--inputs must contain staged provenance');
const pairs=Number(arg('--samples','16'));assert.ok(pairs>=4);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={schemaVersion:1,kind:'UiSdkNativeLaunchBenchmark',createdAt:new Date().toISOString(),inputs:JSON.parse(fs.readFileSync(path.join(dir,'inputs.json'))),
 harnessSha256:sha(fs.readFileSync(__filename)),environment:{os:execFileSync('sw_vers').toString(),cpu:os.cpus()[0].model,memoryBytes:os.totalmem(),loadStart:os.loadavg()},
 method:{pairs,order:'AB/BA, two discarded launches per arm',clock:'process.hrtime.bigint / performance.now',cache:'warm OS/browser caches; fresh process, fixed empty isolated app state',
  end:'enabled language trigger followed by two requestAnimationFrames and fonts.ready; localhost receipt adds IPC/HTTP overhead; not actual screen presentation',
  memory:'macOS footprint host PID only, sampled 800ms after ready; excludes WKWebView WebContent/Networking processes',actions:'readonly startup only; real Tauri status bridge; no Apply/Restore'},apps:{},runs:[],errors:[]};
for(const v of ['before','after']){
 const app=path.join(dir,v,'Cavalry SDK Benchmark.app'),exe=path.join(app,'Contents/MacOS/cavalry-i18n-tauri');
 assert.ok(fs.existsSync(exe));report.apps[v]={app,exe,sha256:sha(fs.readFileSync(exe)),executableBytes:fs.statSync(exe).size,
  bundleBytes:Number(execFileSync('du',['-sk',app]).toString().split(/\s/)[0])*1024};
}
fs.copyFileSync(__filename,path.join(dir,'native-harness.js'));
const save=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
let pending,child;
const server=http.createServer((req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','content-type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 let body='';req.on('data',b=>body+=b);req.on('end',()=>{res.writeHead(200);res.end('ok');if(req.url==='/ready'&&pending){const p=pending;pending=null;p.resolve({launchReadyMs:Number(process.hrtime.bigint()-p.start)/1e6,...JSON.parse(body)});}else if(req.url==='/error')report.errors.push(body);});
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(variant,pair,measured){
 const state=path.join(dir,'isolated-state');fs.mkdirSync(state,{recursive:true});
 const sample=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending=null;reject(new Error('Native ready timeout '+variant));},30000);
  pending={start:process.hrtime.bigint(),resolve:v=>{clearTimeout(timer);resolve(v);}};
  child=spawn(report.apps[variant].exe,[],{env:{...process.env,CAVALRY_I18N_STATE_DIR:state},stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',b=>fs.appendFileSync(path.join(dir,'native-stderr.log'),b));
  child.once('error',reject);child.once('exit',code=>{if(pending){clearTimeout(timer);pending=null;reject(new Error('Native early exit '+code));}});
 });
 assert.equal(sample.width,400);assert.equal(sample.height,504);assert.equal(sample.visibility,'visible');
 await sleep(800);
 if(measured){
  const file=path.join(dir,`footprint-${pair}-${variant}.json`);
  execFileSync('footprint',['-p',String(child.pid),'--noCategories','-j',file],{stdio:'ignore'});
  const fp=JSON.parse(fs.readFileSync(file));sample.hostPhysicalFootprintBytes=fp['total footprint'];
  report.runs.push({variant,pair,pid:child.pid,...sample});save();
 }
 const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await ended;child=null;await sleep(400);
}
(async()=>{
 await new Promise(resolve=>server.listen(18763,'127.0.0.1',resolve));
 for(let i=0;i<2;i++)for(const v of ['before','after'])await launch(v,-1,false);
 for(let pair=0;pair<pairs;pair++){
  for(const v of pair%2?['after','before']:['before','after'])await launch(v,pair,true);
  console.log('native pairs '+(pair+1)+'/'+pairs);
 }
 report.environment.loadEnd=os.loadavg();save();
})().catch(e=>{report.errors.push(e.stack);save();console.error(e);process.exitCode=1;}).finally(()=>{child?.kill('SIGTERM');server.close();});
