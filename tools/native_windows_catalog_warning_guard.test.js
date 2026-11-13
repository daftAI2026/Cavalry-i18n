/**
 * [INPUT]: Windows guard生成器、production manifest形状及冻结17目录。
 * [OUTPUT]: 摘要/locale精确投影与preview、不完整、缺摘要及越界目录拒绝回归。
 * [POS]: 构建期降噪证明的离线合同；不读真实用户包或安装目录。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {renderGuard}=require('./native_windows_catalog_warning_guard');
const {catalogs}=require('./cavalry_native_target.json');
function fixture(){
  return {manifest:{kind:'production-2.8',cavalryVersion:'2.8.0',nativeKeys:1,complete:true,packs:Object.fromEntries(
    ['zh-Hans','zh-Hant','ja_JP'].map(language=>[language,{nativeLocale:language==='ja_JP'?'ja':language,
      sha256:'a'.repeat(64),bytes:100,reviewed:1,preserved:0,vendor:0,missing:0}]))}};
}
test('guard binds all 17 official catalogs and exact three production pack identities',()=>{
  const text=renderGuard(fixture(),catalogs);
  assert.match(text,/"ja_JP","ja","a{64}",100/);
  for(const row of catalogs)assert.ok(text.includes(JSON.stringify(row.id)));
});
for(const [name,mutate] of [
  ['preview',value=>{value.manifest.kind='development-preview';}],
  ['incomplete',value=>{value.manifest.complete=false;value.manifest.packs['zh-Hans'].reviewed=0;value.manifest.packs['zh-Hans'].missing=1;}],
  ['locale drift',value=>{value.manifest.packs.ja_JP.nativeLocale='ja-JP';}],
  ['absent digest',value=>{delete value.manifest.packs['zh-Hans'].sha256;}],
  ['oversize pack',value=>{value.manifest.packs['zh-Hans'].bytes=4*1024*1024+1;}],
])test(`guard refuses ${name}`,()=>{const value=fixture();mutate(value);assert.throws(()=>renderGuard(value,catalogs));});
test('guard rejects unknown count, duplicated and escaping catalog identities',()=>{
  assert.throws(()=>renderGuard(fixture(),catalogs.slice(1)));
  assert.throws(()=>renderGuard(fixture(),catalogs.map(()=>catalogs[0])));
  assert.throws(()=>renderGuard(fixture(),[{id:'../evil'},...catalogs.slice(1)]));
});
