/**
 * [INPUT]: 固定SDK官方默认约定、真实renderer、相同本地只读bridge与浏览器输入。
 * [OUTPUT]: 组件默认焦点/搜索/队列及业务接线验收；更新说明的四语、长文滚动、关闭回焦、文本安全、缺说明及安装单次；真实SDK核Windows 2.8.1禁用期同步与成功后清空，不把旧自绘交互当SDK预期。
 * [POS]: 当前SDK默认组件合同；legacy cases.js仅供历史对照。
 * [PROTOCOL]: 变更时更新此头部，然后检查CLAUDE.md。
 */
const assert = require('node:assert/strict');
const cases = [
  ['sdk-selection', async d => {
    await d.fresh();
    assert.equal(await d.page.locator('#languageSelect').inputValue(), '');
    assert.equal(await d.page.locator('#applyButton').isDisabled(), true);
    await d.capture('empty');
    await d.focus('#languageSelectTrigger');await d.key('Space');
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.open), true);
    assert.equal(await d.page.evaluate(()=>document.activeElement.getAttribute('role')), 'option');
    await d.capture('open');await d.key('ArrowDown');await d.key('Enter');
    assert.equal(await d.page.locator('#languageSelect').inputValue(), 'zh-Hant');
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.value), 'zh-Hant');
    assert.equal(await d.page.locator('#languageSelectValue').textContent(), '繁體中文');
    assert.equal(await d.page.locator('#applyButton').isDisabled(), false);
    assert.equal(await d.page.evaluate(()=>document.activeElement.id), 'languageSelectTrigger');
    await d.capture('selected');
    await d.key('Space');await d.key('Escape');assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.open),false);
  }],
  ['sdk-select-pointer', async d => {
    await d.fresh();
    const p = await d.point('#languageSelectTrigger');await d.page.mouse.move(p.x,p.y);await d.page.mouse.down();await d.tick(40);
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.open),true);
    const geometry = await d.page.evaluate(()=>{
      const trigger=document.querySelector('#languageSelectTrigger').getBoundingClientRect();
      const popup=document.querySelector('#languageSelectPopup').getBoundingClientRect();
      const placeholder=document.querySelector('#languageSelectPopupPlaceholder').getBoundingClientRect();
      return {triggerY:trigger.y,popupY:popup.y,triggerCenter:trigger.y+trigger.height/2,placeholderCenter:placeholder.y+placeholder.height/2};
    });
    assert.equal(geometry.popupY,geometry.triggerY);assert.equal(geometry.placeholderCenter,geometry.triggerCenter);
    assert.equal(await d.page.locator('#languageSelectPopupPlaceholder').textContent(),await d.page.locator('#languageSelectValue').textContent());
    await d.capture('first-press');await d.page.mouse.up();await d.tick(100);
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'');
    assert.equal(await d.page.locator('#applyButton').isDisabled(),true);await d.capture('release-keeps-empty');
    await d.key('Escape');await d.page.mouse.move(p.x,p.y);await d.page.mouse.down();await d.tick(100);
    const row=await d.page.locator('.select-item[value="zh-Hant"]').boundingBox();
    await d.page.mouse.move(row.x+row.width/2,row.y+row.height/2,{steps:5});await d.tick(100);await d.page.mouse.up();await d.tick(100);
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'zh-Hant');
    assert.deepEqual((await d.state()).calls,[]);await d.capture('drag-select');
    await d.click('#languageSelectTrigger');
    const alignment=await d.page.evaluate(()=>{
      const t=document.querySelector('#languageSelectTrigger').getBoundingClientRect();
      const item=document.querySelector('.select-item[value="zh-Hant"]').getBoundingClientRect();
      return [t.y+t.height/2,item.y+item.height/2];
    });
    assert.equal(alignment[0],alignment[1]);await d.capture('selected-aligned');
    await d.click('#applyButton');assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.open),false);
    assert.deepEqual((await d.state()).calls,[]);
  }],
  ['sdk-typeahead', async d => {
    await d.fresh('clean');
    await d.page.evaluate(()=>languageSelectControl.setOptions([{value:'a',label:'Alpha'},{value:'b',label:'Beta',disabled:true},{value:'c',label:'Charlie'}]));
    await d.focus('#languageSelectTrigger');await d.key('c');
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'c');
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.open),false);
    await d.key('Space');await d.key('Home');await d.key('ArrowDown');await d.key('Enter');
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'c');
    await d.capture('typeahead-and-disabled');
  }],
  ['sdk-dialog', async d => {
    await d.fresh('nativeOwnedHans');await d.focus('#restoreButton');await d.key('Enter');
    assert.equal(await d.page.locator('#confirmationDialog').evaluate(e=>e.open),true);
    assert.equal(await d.page.evaluate(()=>document.activeElement.id),'modalSecondaryButton');
    await d.capture('cancel-first');await d.key('Escape');await d.tick(300);
    assert.equal(await d.page.locator('#confirmationDialog').evaluate(e=>e.open),false);
    assert.deepEqual((await d.state()).calls,[]);
    await d.click('#restoreButton');await d.click('#modalSecondaryButton');await d.tick(300);
    assert.equal(await d.page.locator('#confirmationDialog').evaluate(e=>e.open),false);
    assert.deepEqual((await d.state()).calls,[]);
    await d.click('#restoreButton');await d.click('#modalPrimaryButton');await d.tick(7000);
    assert.deepEqual((await d.state()).calls.filter(c=>c[0]==='applyLanguage'),[['applyLanguage','en']]);
    await d.capture('restore-completed');
  }],
  ['sdk-business', async d => {
    await d.fresh();await d.choose('zh-Hant');await d.click('#applyButton');await d.tick(7000);
    assert.deepEqual((await d.state()).calls.filter(c=>c[0]==='applyLanguage'),[['applyLanguage','zh-Hant']]);
    assert.equal((await d.state()).activity.state,'completed');await d.capture('switch-completed');
    await d.fresh('error');await d.tick(7000);
    assert.equal((await d.state()).activity.state,'error');await d.capture('failure-kept');
  }],
  ['sdk-disabled-sync', async d => {
    await d.fresh('nativeWindows281');await d.choose('zh-Hant');
    await d.page.evaluate(()=>setBusy(true));
    await d.page.evaluate(()=>languageSelectControl.setValue(''));
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'');
    assert.ok(!(await d.page.locator('#languageSelectRoot').evaluate(e=>e.value)));
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.disabled),true);
    assert.equal(await d.page.locator('#languageSelectTrigger').isDisabled(),true);
    await d.page.evaluate(()=>languageSelectControl.setValue('ja_JP'));
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'ja_JP');
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.value),'ja_JP');
    await d.page.evaluate(()=>languageSelectControl.setOptions([{value:'en',label:'English'}]));
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'');
    assert.ok(!(await d.page.locator('#languageSelectRoot').evaluate(e=>e.value)));
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.disabled),true);
    assert.equal(await d.page.locator('#languageSelectTrigger').isDisabled(),true);
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.api.setValue('en')),false);
    assert.deepEqual((await d.state()).calls,[]);await d.capture('disabled-data-sync');
  }],
  ['sdk-switch-value-reset', async d => {
    await d.fresh('nativeWindows281');
    assert.equal(await d.page.locator('html').getAttribute('data-platform'),'windows');
    assert.ok((await d.page.locator('#appVersion').textContent()).includes('2.8.1'));
    const expected=[];
    for(const language of ['zh-Hans','zh-Hant','ja_JP']) {
      await d.choose(language);await d.click('#applyButton');
      assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.disabled),true);
      await d.tick(7000);expected.push(['applyLanguage',language]);
      assert.deepEqual((await d.state()).calls.filter(c=>c[0]==='applyLanguage'),expected);
      assert.equal((await d.state()).activity.state,'completed');
      assert.equal(await d.page.locator('#languageSelect').inputValue(),'');
      assert.ok(!(await d.page.locator('#languageSelectRoot').evaluate(e=>e.value)));
      assert.equal(await d.page.locator('#languageSelectValue').textContent(),await d.page.locator('#languageSelectPopupPlaceholder').textContent());
      assert.equal(await d.page.locator('#applyButton').isDisabled(),true);
      assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.disabled),false);
      await d.click('#languageSelectTrigger');
      assert.equal(await d.page.locator('.select-item[value="'+language+'"]').getAttribute('aria-disabled'),'true');
      await d.key('Escape');await d.capture('reset-after-'+language);
    }
  }],
  ['sdk-busy-closes-select', async d => {
    await d.fresh('nativeWindows281');await d.choose('zh-Hant');await d.click('#languageSelectTrigger');
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.open),true);
    await d.page.evaluate(()=>setBusy(true));await d.tick(300);
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.open),false);
    assert.equal(await d.page.locator('#languageSelectPopup').isVisible(),false);
    assert.equal(await d.page.locator('#languageSelectTrigger').isDisabled(),true);
    await d.page.locator('#languageSelectRoot').evaluate(e=>e.api.open());
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.open),false);
    await d.page.evaluate(()=>setBusy(false));await d.click('#languageSelectTrigger');
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.open),true);
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'zh-Hant');
    assert.deepEqual((await d.state()).calls,[]);await d.key('Escape');await d.capture('busy-popup-closed');
  }],
  ['sdk-tooltip', async d => {
    await d.fresh('windowsClean','&preview=update');await d.hover('#updateButton');await d.tick(1000);
    assert.equal(await d.page.locator('#updateTooltip').evaluate(e=>e.hasAttribute('data-open')),true);
    assert.equal(await d.page.locator('#updateTooltip').getAttribute('role'),'tooltip');await d.capture('hover');
    await d.focus('#updateButton');await d.key('Escape');
    assert.equal(await d.page.locator('#updateTooltip').evaluate(e=>e.hasAttribute('data-open')),false);
  }],
  ['sdk-toast', async d => {
    await d.fresh();await d.toast([{title:'One',type:'loading'},{title:'Two',type:'loading'},{title:'Three',description:'Details',type:'loading'}]);
    assert.equal(await d.page.locator('ui-toast-region[role="region"]').getAttribute('aria-keyshortcuts'),'F6');
    assert.equal(await d.page.locator('.toast[data-front] .toast-title').textContent(),'Three');
    await d.focus('#languageSelectTrigger');await d.key('F6');
    assert.equal(await d.page.evaluate(()=>document.activeElement.closest('.toast')?.querySelector('.toast-title').textContent),'Three');
    await d.key('F6');assert.equal(await d.page.evaluate(()=>document.activeElement.id),'languageSelectTrigger');
    await d.key('F6');await d.key('Tab');
    if (d.page.context().browser().browserType().name() === 'webkit') {
      // macOS WebKit skips native buttons with default keyboard access; SDK preserves that policy.
      assert.equal(await d.page.evaluate(()=>document.activeElement.closest('.toast')?.querySelector('.toast-title').textContent),'Two');
      await d.key('Shift+Tab');
    } else assert.equal(await d.page.evaluate(()=>document.activeElement.classList.contains('toast-close')),true);
    await d.capture('keyboard');await d.key('Escape');await d.tick(700);
    assert.equal(await d.page.locator('.toast').count(),2);
    assert.equal(await d.page.evaluate(()=>document.activeElement.closest('.toast')?.querySelector('.toast-title').textContent),'Two');
    await d.click('.toast[data-front] .toast-close');await d.tick(700);
    assert.equal(await d.page.locator('.toast').count(),1);
  }],
  ['sdk-toast-queue', async d => {
    await d.fresh();await d.toast([{title:'One',type:'loading'},{title:'Two',type:'loading'},{title:'Three',type:'loading'},{title:'Four',type:'loading'}]);
    assert.equal(await d.page.locator('.toast:not([hidden]):not([inert])').count(),3);
    const first=await d.page.locator('.toast[data-front] .toast-title').textContent();assert.equal(first,'Four');
    await d.focus('#languageSelectTrigger');await d.key('F6');await d.key('Escape');await d.tick(700);
    assert.equal(await d.page.locator('.toast:not([hidden]):not([inert])').count(),3);
    assert.ok((await d.page.locator('.toast-title').allTextContents()).includes('One'));
    await d.capture('queued-not-discarded');
  }],
  ['sdk-log', async d => {
    await d.fresh();await d.rows();
    await d.hover('#statusViewport');await d.page.mouse.wheel(0,-2000);await d.page.waitForTimeout(100);await d.tick(200);
    const before=await d.page.locator('#statusViewport').evaluate(e=>e.scrollTop);
    assert.ok(await d.page.locator('#statusViewport').evaluate(e=>e.scrollTop<e.scrollHeight-e.clientHeight));
    await d.page.evaluate(()=>operationLog.upsert({id:'held',title:'Held while reading',state:'completed',urgent:true}));await d.tick(200);
    assert.equal(await d.page.locator('#statusViewport').evaluate(e=>e.scrollTop),before);await d.capture('reading-position');
    await d.page.locator('#statusViewport').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await d.tick(100);
    await d.page.evaluate(()=>operationLog.upsert({id:'follow',title:'Follow latest',state:'completed',urgent:true}));await d.tick(250);
    assert.equal(await d.page.locator('#statusViewport').evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop),0);await d.capture('follow-resumed');
  }],
  ['sdk-links-about', async d => {
    await d.fresh();await d.click('#supportGithubLink');await d.click('#supportTwitterLink');await d.click('#supportXiaohongshuLink');
    assert.deepEqual((await d.state()).calls,[['openProjectLink','repository'],['openProjectLink','twitter'],['openProjectLink','xiaohongshu']]);await d.capture('footer');
    await d.fresh('clean','',true);await d.click('#aboutRepositoryLink');
    assert.deepEqual((await d.state()).calls,[['openProjectLink','repository']]);await d.capture('about');
  }],
  ['sdk-update', async d => {
    await d.fresh('updateAvailable');await d.click('#updateButton');await d.tick(200);await d.click('#updateDialogInstall');await d.tick(5000);
    assert.ok(await d.page.locator('ui-progress[role="progressbar"]').count());
    assert.equal(await d.page.locator('ui-progress').first().getAttribute('aria-valuenow'),'100');await d.capture('download-progress');
  }],
  ['sdk-update-dialog', async d => {
    await d.fresh('updateAvailable');await d.click('#updateButton');await d.tick(250);
    const copy=await d.page.evaluate(()=>{
      const locale=new URL(location.href).searchParams.get('locale')||'en';
      const source=UI_TEXT[locale]||UI_TEXT.en;
      return {title:source.updateNotesTitle,later:source.updateLater,install:source.installUpdate,close:source.close,
        empty:source.updateNotesEmpty,adhoc:source.updateMacAdhocNote};
    });
    assert.equal(await d.page.locator('#updateDialog').evaluate(e=>e.open),true);
    assert.equal(await d.page.locator('#updateDialogTitle').textContent(),copy.title);
    assert.equal(await d.page.locator('#updateDialogLater').textContent(),copy.later);
    assert.equal(await d.page.locator('#updateDialogInstall').textContent(),copy.install);
    assert.equal(await d.page.locator('#updateDialogClose').getAttribute('aria-label'),copy.close);
    assert.equal(await d.page.locator('#updateDialogDate').getAttribute('datetime'),'2026-11-16T08:00:00Z');
    assert.equal(await d.page.locator('#updateDialogDate').isVisible(),true);
    assert.ok((await d.page.locator('#updateDialogNotes').textContent()).includes('升级前查看'));
    assert.equal(await d.page.locator('#updateDialogAdhoc').textContent(),copy.adhoc);
    assert.equal(await d.page.locator('#updateDialogAdhoc').isVisible(),true);
    await d.capture('release-notes-fixture');
    await d.key('Escape');await d.tick(350);
    assert.equal(await d.page.locator('#updateDialog').evaluate(e=>e.open),false);
    assert.equal(await d.page.evaluate(()=>document.activeElement.id),'updateButton');
    assert.equal(await d.page.locator('ui-progress').count(),0);

    await d.page.evaluate(()=>{
      const original=document.querySelector('#updateDialog');
      const root=original.cloneNode(true);
      original.remove();document.body.append(root);
      const locale=new URL(location.href).searchParams.get('locale')||'en';
      const source=UI_TEXT[locale]||UI_TEXT.en;
      const text=(key,params={})=>(source[key]??UI_TEXT.en[key]??key).replace(/\{(\w+)\}/g,(_,name)=>String(params[name]??''));
      window.__sdkUpdateInstallCalls=[];
      window.__sdkUpdateDialog=createUpdateDialog({root,text,icons:window.cavalryIcons,
        onInstall:update=>window.__sdkUpdateInstallCalls.push(update.version)});
    });
    await d.page.evaluate(()=>window.__sdkUpdateDialog.show({currentVersion:'0.7.0',version:'0.7.1',notes:'Close with Escape.',pubDate:null,available:true},'windows'));
    await d.tick(300);await d.key('Escape');await d.tick(350);
    assert.equal(await d.page.locator('#updateDialog').evaluate(e=>e.open),false);
    assert.equal(await d.page.evaluate(()=>document.activeElement.id),'updateButton');
    assert.deepEqual(await d.page.evaluate(()=>window.__sdkUpdateInstallCalls),[]);
    const longNotes=Array.from({length:32},(_,index)=>`### Section ${index+1}\n- Stable update detail ${index+1}: review the change before continuing.`).join('\n\n')+
      '\n\n<script>window.__sdkUpdateNotesExecuted = true</script>\n<img src=x onerror="window.__sdkUpdateNotesExecuted = true">';
    const longUpdate={currentVersion:'0.7.0',version:'0.7.2',notes:longNotes,pubDate:'2026-11-16T08:00:00Z',available:true};
    await d.page.evaluate(update=>window.__sdkUpdateDialog.show(update,'macos'),longUpdate);await d.tick(300);
    assert.equal(await d.page.locator('#updateDialogVersion').textContent(),'0.7.2');
    assert.equal(await d.page.locator('#updateDialog').evaluate(e=>e.open),true);
    assert.equal(await d.page.locator('#updateDialogNotes h3').count(),32);
    assert.equal(await d.page.locator('#updateDialogNotes script, #updateDialogNotes img').count(),0);
    assert.ok((await d.page.locator('#updateDialogNotes').textContent()).includes('<script>window.__sdkUpdateNotesExecuted = true</script>'));
    assert.equal(await d.page.evaluate(()=>window.__sdkUpdateNotesExecuted),undefined);
    const layout=await d.page.evaluate(()=>{
      const bounds=selector=>{const {top,bottom}=document.querySelector(selector).getBoundingClientRect();return {top,bottom};};
      const header=bounds('.update-dialog-header'),scroll=bounds('#updateDialogScroll'),footer=bounds('.update-dialog-actions');
      const viewport=document.querySelector('#updateDialogScroll ui-scroll-area-viewport');
      return {header,scroll,footer,viewportHeight:viewport.clientHeight,scrollHeight:viewport.scrollHeight,scrollTop:viewport.scrollTop,
        windowHeight:innerHeight,role:viewport.getAttribute('role'),label:viewport.getAttribute('aria-label')};
    });
    assert.ok(layout.scrollHeight>layout.viewportHeight);
    assert.equal(layout.role,'region');assert.equal(layout.label,copy.title);
    assert.ok(layout.header.top>=0&&layout.header.bottom<layout.scroll.top);
    assert.ok(layout.scroll.bottom<layout.footer.top&&layout.footer.bottom<=layout.windowHeight);
    await d.capture('long-notes-top');
    await d.hover('#updateDialogScroll');await d.page.mouse.wheel(0,420);await d.tick(100);await d.page.waitForTimeout(300);
    const afterWheel=await d.page.locator('#updateDialogScroll ui-scroll-area-viewport').evaluate(e=>e.scrollTop);
    assert.ok(afterWheel>0);await d.capture('long-notes-wheel');
    await d.page.mouse.wheel(0,-10000);await d.tick(150);await d.page.waitForTimeout(300);
    const beforeKey=await d.page.locator('#updateDialogScroll ui-scroll-area-viewport').evaluate(e=>({scrollTop:e.scrollTop,
      scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,active:document.activeElement.localName}));
    assert.ok(beforeKey.scrollTop<afterWheel);
    await d.focus('#updateDialogScroll ui-scroll-area-viewport');
    assert.equal(await d.page.evaluate(()=>document.activeElement.localName),'ui-scroll-area-viewport');
    await d.page.evaluate(()=>{
      window.__sdkPageDownDebug=null;
      document.addEventListener('keydown',event=>{
        if(event.key==='PageDown')window.__sdkPageDownDebug={target:event.target.localName,targetId:event.target.id,
          defaultPrevented:event.defaultPrevented,active:document.activeElement.localName};
      },{once:true});
    });
    await d.key('PageDown');await d.page.waitForTimeout(300);
    let afterKeyTop=await d.page.locator('#updateDialogScroll ui-scroll-area-viewport').evaluate(e=>e.scrollTop);
    for(let attempt=0;attempt<8&&afterKeyTop<=beforeKey.scrollTop;attempt++){
      await d.page.waitForTimeout(50);
      afterKeyTop=await d.page.locator('#updateDialogScroll ui-scroll-area-viewport').evaluate(e=>e.scrollTop);
    }
    const keyboardState=await d.page.evaluate(()=>{
      const viewport=document.querySelector('#updateDialogScroll ui-scroll-area-viewport');
      return {scrollTop:viewport.scrollTop,scrollHeight:viewport.scrollHeight,clientHeight:viewport.clientHeight,
        active:document.activeElement.localName,key:window.__sdkPageDownDebug};
    });
    assert.ok(keyboardState.scrollTop>beforeKey.scrollTop,`PageDown should scroll the focused notes viewport (${JSON.stringify({beforeKey,...keyboardState})})`);
    await d.click('#updateDialogClose');await d.tick(350);
    assert.equal(await d.page.locator('#updateDialog').evaluate(e=>e.open),false);
    assert.equal(await d.page.evaluate(()=>document.activeElement.id),'updateButton');
    assert.deepEqual(await d.page.evaluate(()=>window.__sdkUpdateInstallCalls),[]);

    await d.page.evaluate(()=>window.__sdkUpdateDialog.show({currentVersion:'0.7.2',version:'0.7.3',notes:null,pubDate:'not-a-date',available:true},'windows'));
    await d.tick(300);
    assert.equal(await d.page.locator('#updateDialogVersion').textContent(),'0.7.3');
    assert.equal(await d.page.locator('#updateDialogDate').isVisible(),false);
    assert.equal(await d.page.locator('#updateDialogDate').getAttribute('datetime'),null);
    assert.equal(await d.page.locator('#updateDialogNotes').textContent(),copy.empty);
    assert.equal(await d.page.locator('#updateDialogAdhoc').isVisible(),false);
    assert.equal(await d.page.locator('#updateDialogScroll ui-scroll-area-viewport').evaluate(e=>e.scrollTop),0);
    await d.capture('notes-unavailable');
    await d.click('#updateDialogLater');await d.tick(350);
    assert.equal(await d.page.locator('#updateDialog').evaluate(e=>e.open),false);
    assert.equal(await d.page.evaluate(()=>document.activeElement.id),'updateButton');
    assert.deepEqual(await d.page.evaluate(()=>window.__sdkUpdateInstallCalls),[]);

    await d.page.evaluate(()=>window.__sdkUpdateDialog.show({currentVersion:'0.7.3',version:'0.7.4',notes:'A concise release note.',pubDate:'2026-11-17T08:00:00Z',available:true},'windows'));
    await d.tick(300);
    assert.equal(await d.page.locator('#updateDialogVersion').textContent(),'0.7.4');
    assert.equal(await d.page.locator('#updateDialogScroll ui-scroll-area-viewport').evaluate(e=>e.scrollTop),0);
    assert.equal(await d.page.locator('#updateDialogAdhoc').isVisible(),false);
    await d.click('#updateDialogInstall');await d.tick(350);
    assert.equal(await d.page.locator('#updateDialog').evaluate(e=>e.open),false);
    assert.equal(await d.page.evaluate(()=>document.activeElement.id),'updateButton');
    assert.deepEqual(await d.page.evaluate(()=>window.__sdkUpdateInstallCalls),['0.7.4']);
    await d.capture('install-once');
  }],
  ['sdk-agent', async d => {
    const path = require('node:path');
    const bundle = require('esbuild').buildSync({
      stdin: { contents: `import './tools/ui_sdk_entry.mjs';import {createAgent} from '@ui-sdk/web/agent';window.__sdkAgent=createAgent({allow:()=>true});`, resolveDir: path.resolve(__dirname, '../..') },
      bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022',
    }).outputFiles[0].text;
    async function act(ref, value) {
      const pending = d.page.evaluate(({ref,value})=>window.__sdkAgent.act({steps:[{ref,action:'setValue',args:[value]}]}),{ref,value});
      await d.tick(1000);return pending;
    }
    await d.page.route('**/renderer/ui-sdk.js', route => route.fulfill({contentType:'text/javascript',body:bundle}));
    await d.fresh();
    const [select] = await d.page.evaluate(()=>window.__sdkAgent.query({kind:'select'}));
    assert.ok(select.label);assert.ok(select.items.some(item=>item.value==='zh-Hans'));
    await act(select.ref,'zh-Hans');
    assert.equal(await d.page.locator('#languageSelectRoot').evaluate(e=>e.value),'zh-Hans');
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'zh-Hans');
    assert.equal(await d.page.locator('#languageSelectValue').textContent(),'简体中文');
    assert.equal(await d.page.locator('#applyButton').isDisabled(),false);
    await act(select.ref,'__invalid__');
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'zh-Hans');
    await d.page.locator('#languageSelectRoot').evaluate(e=>{e.disabled=true;});
    const disabled = await d.page.evaluate(()=>window.__sdkAgent.query({kind:'select'}));
    assert.equal(disabled[0].actions.includes('setValue'),false);
    await act(select.ref,'zh-Hant');
    assert.equal(await d.page.locator('#languageSelect').inputValue(),'zh-Hans');
    assert.deepEqual((await d.state()).calls,[]);
    await d.capture('agent-selection');
    await d.fresh('nativeOwnedHans');await d.click('#restoreButton');
    const [dialog] = await d.page.evaluate(()=>window.__sdkAgent.query({kind:'alert-dialog'}));
    assert.ok(dialog.buttons.includes(await d.page.locator('#modalSecondaryButton').textContent()));
    assert.ok(dialog.buttons.includes(await d.page.locator('#modalPrimaryButton').textContent()));
    assert.deepEqual((await d.state()).calls,[]);await d.capture('agent-confirmation');
  }],
];
const retained = new Set(['business','permission','guidance','viewport','hand','reduced-motion']);
for (const [name, run] of require('./cases').cases) if (retained.has(name)) cases.push(['business-'+name, run]);
module.exports={cases};
