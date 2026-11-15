/**
 * [INPUT]: 最新 main 的可观察交互与相同的黑盒 driver。
 * [OUTPUT]: 独立于SDK的状态/视觉测试目标；先在main通过，再要求候选同样通过。
 * [POS]: 原有业务与组件兼容合同，不按候选结果生成预期。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const assert = require('node:assert/strict');
const cases = [
  ['controls', async d => {
    await d.fresh(); assert.equal((await d.state()).applyDisabled, true); await d.capture('empty-disabled');
    await d.choose(); assert.equal((await d.state()).language, 'zh-Hant'); await d.capture('selected');
    await d.hover('#applyButton'); await d.capture('button-hover');
    await d.focus('#applyButton'); await d.capture('button-focus');
    const p = await d.point('#applyButton'); await d.page.mouse.move(p.x,p.y); await d.page.mouse.down();
    await d.capture('button-pressed'); await d.page.mouse.move(5,480); await d.page.mouse.up();
    await d.focus('#languageSelectTrigger'); await d.key('Space'); await d.capture('select-keyboard-open');
    await d.key('End'); await d.key('Enter'); assert.equal((await d.state()).language, 'ja_JP'); await d.capture('select-keyboard-commit');
    await d.key('Space'); await d.key('Escape'); assert.equal((await d.state()).expanded,'false');
    await d.capture('select-escape');
  }],
  ['selection', async d => {
    await d.fresh(); await d.click('#languageSelectTrigger'); await d.capture('select-placeholder');
    await d.hover('.select-item:last-child'); await d.capture('select-hover');
    await d.page.mouse.click(5,480); await d.tick(50); assert.equal((await d.state()).expanded,'false');
    await d.choose('zh-Hans'); await d.click('#languageSelectTrigger'); await d.capture('select-selected-alignment');
    await d.key('Tab'); await d.page.mouse.move(5,480); await d.capture('select-tab-out');
  }],
  ['selection-policy', async d => {
    await d.fresh();await d.page.evaluate(()=>{languageSelectControl.setOptions([{value:'a',label:'Alpha'},{value:'b',label:'Alpine',disabled:true},{value:'c',label:'Alto'},{value:'d',label:'Beta'}]);languageSelectControl.setValue('');});
    await d.focus('#languageSelectTrigger');await d.key('a');assert.equal((await d.state()).activeOption,'Alto');await d.capture('typeahead-first');
    await d.key('l');assert.equal((await d.state()).activeOption,'Alpha');await d.capture('typeahead-prefix-next');
    await d.key('Escape');await d.tick(600);await d.key('ArrowUp');assert.equal((await d.state()).activeOption,'Alpha');
    await d.key('ArrowUp');assert.equal((await d.state()).activeOption,'Beta');await d.key('ArrowDown');assert.equal((await d.state()).activeOption,'Alpha');await d.capture('selection-wrap');
    await d.key('ArrowDown');assert.equal((await d.state()).activeOption,'Alto');await d.key('Enter');assert.equal((await d.state()).language,'c');await d.capture('selection-skip-disabled');
  }],
  ['scroll-edge-policy',async d=>{
    for(const distance of [3,30]){
      await d.fresh();await d.rows();await d.hover('#statusViewport');await d.page.mouse.wheel(0,-distance);await d.page.waitForTimeout(100);await d.tick(100);
      const before=await d.page.locator('#statusViewport').evaluate(e=>e.scrollTop);
      await d.page.evaluate(()=>operationLog.upsert({id:'near-edge',title:'New result',state:'completed',urgent:true}));await d.tick(250);
      const scroll=await d.page.locator('#statusViewport').evaluate(e=>({top:e.scrollTop,gap:e.scrollHeight-e.clientHeight-e.scrollTop}));
      if(distance<=4)assert.equal(scroll.gap,0);else assert.equal(scroll.top,before);
      await d.capture('scroll-edge-'+distance);
    }
  }],
  ['scroll-keyboard',async d=>{
    await d.fresh();await d.rows();await d.focus('#languageSelectTrigger');
    // 不指定浏览器的Tab偏好；逐步对照main原生滚动区的焦点路线。
    for(let step=1;step<=3;step++){await d.key('Tab');await d.capture('scroll-tab-'+step);}
    await d.focus('#supportGithubLink');await d.key('Shift+Tab');await d.capture('scroll-reverse-tab');
    await d.page.evaluate(()=>operationLog.clear());await d.focus('#languageSelectTrigger');await d.key('Tab');await d.capture('scroll-idle-tab');
  }],
  ['scroll-resize-policy',async d=>{
    await d.fresh();await d.rows();await d.hover('#statusViewport');await d.page.mouse.wheel(0,-2000);await d.page.waitForTimeout(100);await d.tick(100);
    assert.equal(await d.page.locator('#statusViewport').evaluate(e=>e.scrollTop),0);
    await d.page.setViewportSize({width:400,height:1600});await d.page.evaluate(()=>operationLog.upsert({id:'fit',title:'Fits in the viewport',state:'completed',urgent:true}));await d.tick(100);
    assert.equal(await d.page.locator('#statusViewport').evaluate(e=>e.scrollHeight>e.clientHeight),false);
    await d.page.setViewportSize({width:400,height:504});await d.page.evaluate(()=>operationLog.upsert({id:'after-fit',title:'Following again',state:'completed',urgent:true}));await d.tick(100);
    assert.equal(await d.page.locator('#statusViewport').evaluate(e=>e.scrollHeight-e.clientHeight-e.scrollTop),0);await d.capture('scroll-fit-resumes-following');
  }],
  ['overlay-focus',async d=>{
    await d.fresh();await d.toast([{title:'Cross focus',type:'loading'}]);await d.focus('#languageSelectTrigger');await d.key('Space');await d.key('F6');
    assert.equal((await d.state()).expanded,'true');assert.equal((await d.state()).focus,'toast');await d.capture('select-toast-focus');
    await d.click('.toast-close');assert.equal((await d.state()).expanded,'false');await d.tick(650);await d.capture('toast-click-closes-select');
    await d.fresh('translated');await d.toast([{title:'Modal focus',type:'loading'}]);await d.click('#restoreButton');await d.key('F6');
    assert.equal((await d.state()).modal.visible,true);assert.equal((await d.state()).focus,'modalPrimaryButton');await d.capture('modal-blocks-toast-focus');
  }],
  ['restore', async d => {
    await d.fresh('translated'); await d.focus('#restoreButton'); await d.key('Enter');
    assert.equal((await d.state()).modal.visible,true); assert.equal((await d.state()).focus,'modalPrimaryButton');
    await d.page.mouse.move(5,80); await d.capture('restore-open'); await d.key('Tab'); await d.capture('restore-secondary-focus');
    await d.key('Tab'); await d.capture('restore-tab-cycle');
    await d.key('Escape'); await d.page.mouse.click(5,80); await d.tick(50); assert.equal((await d.state()).modal.visible,true);
    await d.click('#modalSecondaryButton'); await d.tick(600); assert.equal((await d.state()).modal.visible,false);
    assert.equal((await d.state()).focus,'restoreButton'); assert.deepEqual((await d.state()).calls,[]); await d.capture('restore-cancel');
    await d.fresh('translated');await d.click('#restoreButton');await d.click('#modalSecondaryButton');await d.tick(600);await d.capture('restore-pointer-return');
  }],
  ['tooltip', async d => {
    await d.fresh('windowsClean','&preview=update'); await d.hover('#updateButton'); await d.tick(200); await d.capture('tooltip-hover');
    await d.key('Escape'); await d.page.mouse.move(390,490); await d.focus('#updateButton'); await d.capture('tooltip-focus');
    await d.key('Escape'); await d.tick(250); await d.capture('tooltip-escape');
    await d.hover('#updateButton'); await d.hover('#aboutButton'); await d.tick(250); await d.capture('tooltip-group');
    await d.click('#aboutButton'); await d.tick(250); await d.capture('tooltip-click-close');
  }],
  ['toast', async d => {
    await d.fresh(); await d.toast([{title:'First',description:'First notification',type:'error'},
      {title:'Second',description:'Second notification',type:'success'},{title:'Third',description:'Third notification',type:'warning'}]);
    await d.capture('toast-stack'); await d.hover('.toast:has(.toast-title:text-is("Third"))'); await d.tick(600); await d.capture('toast-hover');
    await d.page.mouse.move(2,2); await d.key('F6'); await d.tick(600); await d.capture('toast-focus');
    await d.key('Escape'); await d.tick(600); assert.equal((await d.state()).toasts.length,2); await d.capture('toast-close');
  }],
  ['toast-keyboard', async d => {
    await d.fresh(); await d.toast(['First','Second','Third'].map(title=>({title,type:'loading'})));
    await d.focus('#languageSelectTrigger'); await d.key('F6');
    assert.equal((await d.state()).focusedToast,'Third'); await d.capture('toast-f6');
    await d.key('F6'); await d.capture('toast-f6-again');
    for(let step=1;step<=4;step++){await d.key('Tab');await d.capture('toast-tab-'+step);}
    await d.key('F6');
    for(let step=1;step<=4;step++){await d.key('Shift+Tab');await d.capture('toast-shift-tab-'+step);}
  }],
  ['toast-pointer', async d => {
    await d.fresh();await d.toast([{title:'Keep on drag',type:'warning'}],0);await d.capture('toast-pointer-ready');
    const p=await d.point('.toast-icon');await d.page.mouse.move(p.x,p.y);await d.page.mouse.down();await d.page.mouse.move(p.x+120,p.y,{steps:8});await d.page.mouse.up();await d.tick(650);
    assert.equal((await d.state()).toasts.length,1);await d.capture('toast-drag-retained');
    await d.click('.toast-close');await d.tick(650);assert.equal((await d.state()).toasts.length,0);await d.capture('toast-pointer-closed');
    for(const key of ['Enter','Space']){
      await d.fresh();await d.toast([{title:key+' closes',type:'info'}]);await d.key('F6');await d.key('Tab');await d.key(key);await d.tick(650);
      assert.equal((await d.state()).toasts.length,0);await d.capture('toast-'+key.toLowerCase()+'-closed');
    }
  }],
  ['toast-limit', async d => {
    await d.fresh(); await d.toast([0,1,2,3].map(i=>({title:'Toast '+i,type:'loading'})));
    assert.deepEqual((await d.state()).toasts.map(t=>t.title),['Toast 1','Toast 2','Toast 3']); await d.capture('toast-limit');
    await d.page.evaluate(()=>__testToast.close(__toastIds[3])); await d.tick(650);
    assert.deepEqual((await d.state()).toasts.map(t=>t.title),['Toast 1','Toast 2']); await d.capture('toast-no-hidden-queue');
  }],
  ['toast-timer', async d => {
    await d.fresh(); await d.toast([{title:'Timer',type:'info'}],1500);
    await d.page.locator('.toast').hover(); await d.tick(1800);
    assert.equal((await d.state()).toasts.length,1); await d.capture('toast-paused');
    await d.page.mouse.move(2,2); await d.tick(2100); assert.equal((await d.state()).toasts.length,0); await d.capture('toast-expired');
  }],
  ['activity', async d => {
    await d.fresh(); await d.page.evaluate(()=>{operationLog.start('Applying language');operationLog.upsert({id:'apply',title:'Applying translation',description:'Please wait',state:'running',urgent:true})});
    await d.tick(700); await d.capture('activity-running');
    await d.page.evaluate(()=>operationLog.upsert({id:'apply',title:'Translation applied',description:'Ready',state:'completed',urgent:true}));
    await d.tick(500); await d.capture('activity-complete');
    await d.page.evaluate(()=>operationLog.upsert({id:'failed',title:'Could not restart',description:'Try again',state:'error',urgent:true}));
    await d.tick(500); await d.capture('activity-error');
  }],
  ['scroll', async d => {
    await d.fresh(); await d.rows(); await d.capture('scroll-follow');
    await d.hover('#statusViewport'); await d.page.mouse.wheel(0,-3000); await d.page.waitForTimeout(100); await d.tick(200);
    const y=await d.page.locator('#statusViewport').evaluate(e=>e.scrollTop);
    await d.page.evaluate(()=>operationLog.upsert({id:'new',title:'New result',state:'completed',urgent:true})); await d.tick(200);
    assert.equal(await d.page.locator('#statusViewport').evaluate(e=>e.scrollTop),y); await d.capture('scroll-reading');
    await d.page.mouse.wheel(0,3000); await d.page.waitForTimeout(100); await d.tick(200); await d.capture('scroll-resume');
  }],
  ['business', async d => {
    await d.fresh(); await d.choose(); await d.page.evaluate(()=>__parity.holdApply=true); await d.click('#applyButton');
    assert.equal((await d.state()).selectDisabled,true); assert.equal((await d.state()).applyDisabled,true); await d.capture('apply-busy');
    await d.page.evaluate(()=>__parity.release()); await d.tick(7000);
    assert.equal((await d.state()).currentLanguage,'繁體中文'); assert.equal((await d.state()).selectDisabled,false); await d.capture('apply-success');
  }],
  ['permission', async d => {
    await d.fresh('permissionMac'); await d.tick(5000); assert.equal((await d.state()).modal.visible,true); await d.capture('permission-blocked');
    await d.click('#modalPrimaryButton'); assert.equal((await d.state()).modal.visible,true); await d.capture('permission-await-ack');
    await d.page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window.parent,data:{type:'cavalry-ui-review:permission-handoff-opened'}})));
    await d.tick(600); assert.equal((await d.state()).modal.visible,false); await d.capture('permission-native-owned');
  }],
  ['links-about', async d => {
    await d.fresh(); await d.hover('#supportGithubLink'); await d.capture('footer-hover');
    await d.focus('#supportTwitterLink'); await d.capture('footer-focus'); await d.click('#supportTwitterLink');
    assert.deepEqual((await d.state()).calls,[['openProjectLink','twitter']]);
    await d.fresh('clean','',true); await d.hover('#aboutTwitterLink'); await d.capture('about-hover');
    await d.focus('#aboutRepositoryLink'); await d.capture('about-focus'); await d.click('#aboutRepositoryLink');
    assert.deepEqual((await d.state()).calls,[['openProjectLink','repository']]);
  }],
  ['guidance', async d => {
    for(const scenario of ['notFound','nativeResourceUnavailable','nativeRecoveryNoResources','nativeLegacyRelease','error','verifyFailure','warning']) {
      await d.fresh(scenario); await d.tick(6000); await d.capture(scenario);
    }
  }],
  ['motion', async d => {
    await d.fresh();await d.choose();await d.capture('motion-ready');await d.hover('#applyButton');
    for(const at of [0,75,150])await d.capture('button-hover-'+at,{motionAt:at});
    const p=await d.point('#applyButton');await d.page.mouse.down();
    for(const at of [0,75,150])await d.capture('button-press-'+at,{motionAt:at});
    await d.page.mouse.move(5,480);await d.page.mouse.up();
    await d.fresh('windowsClean','&preview=update');await d.hover('#updateButton');
    for(const at of [0,75,150])await d.capture('tooltip-enter-'+at,{motionAt:at});
    await d.page.mouse.move(390,490);await d.tick(50);
    for(const at of [0,75,150])await d.capture('tooltip-exit-'+at,{motionAt:at});
    await d.fresh();await d.page.evaluate(()=>{operationLog.start('Applying language');operationLog.upsert({id:'apply',title:'Applying translation',state:'running',urgent:true});});await d.tick(500);
    for(const at of [0,150,500,1000])await d.capture('spinner-shimmer-'+at,{motionAt:at});
  }],
  ['toast-motion', async d => {
    await d.fresh();await d.toast([{title:'Animated notification',description:'Same timing and focus',type:'info'}],5000,0);
    await d.capture('toast-enter-0',{motionAt:0});await d.tick(32);
    for(const at of [75,250,500])await d.capture('toast-enter-'+at,{motionAt:at});
    await d.key('F6');await d.page.evaluate(()=>__testToast.close(__toastIds[0]));
    await d.capture('toast-exit-0',{motionAt:0});await d.tick(250);await d.capture('toast-exit-250',{motionAt:250});
    await d.tick(300);await d.capture('toast-exit-complete');
    await d.fresh();await d.page.evaluate(()=>{window.__testToast=createToastControl();const id=__testToast.show({title:'Closed before entry',type:'info'});__testToast.close(id);});
    await d.tick(32);assert.equal((await d.state()).toasts[0].ending,true);await d.capture('toast-closed-before-entry',{motionAt:0});
    await d.tick(550);assert.equal((await d.state()).toasts.length,0);await d.capture('toast-immediate-close-complete');
  }],
  ['update', async d => {
    await d.fresh('updateConfirm');await d.tick(1000);await d.capture('update-confirm');
    await d.click('#modalPrimaryButton');await d.tick(450);await d.capture('update-download');
    await d.tick(7000);await d.capture('update-completed');
    await d.fresh('updateFailure');await d.tick(8000);await d.capture('update-failure');
  }],
  ['keyboard-actions', async d => {
    await d.fresh();await d.choose();await d.page.evaluate(()=>__parity.holdApply=true);await d.focus('#applyButton');await d.key('Enter');
    assert.deepEqual((await d.state()).calls,[['applyLanguage','zh-Hant']]);await d.key('Space');assert.equal((await d.state()).calls.length,1);await d.capture('keyboard-busy');
    await d.page.evaluate(()=>__parity.release());await d.tick(7000);await d.capture('keyboard-success');
    await d.fresh('translated');await d.click('#restoreButton');await d.click('#modalPrimaryButton');await d.tick(7000);
    assert.deepEqual((await d.state()).calls,[['applyLanguage','restore-official']]);await d.capture('restore-confirmed');
    await d.fresh('clean','',true);await d.focus('#aboutTwitterLink');await d.key('Space');assert.deepEqual((await d.state()).calls,[]);
    await d.key('Enter');assert.deepEqual((await d.state()).calls,[['openProjectLink','twitter']]);await d.capture('link-keyboard');
  }],
  ['viewport',async d=>{
    for(const viewport of [{width:400,height:504},{width:420,height:524},{width:600,height:700}]){
      await d.page.setViewportSize(viewport);await d.fresh();await d.choose();await d.click('#languageSelectTrigger');
      assert.equal(await d.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await d.capture('viewport-'+viewport.width);
    }
  }],
  ['hand',async d=>{
    for(const [random,target]of [[0,'repository'],[0.5,'twitter'],[0.99,'xiaohongshu']]){
      await d.fresh();await d.page.evaluate(()=>localStorage.removeItem('cavalry-i18n:follow-hand-seen'));await d.fresh();
      await d.page.evaluate(random=>{Math.random=()=>random;operationLog.start('Complete');operationLog.complete('Ready');
        supportFooterControl.setBusy(false);supportFooterControl.offerAfterSuccess('Ready');},random);
      await d.tick(1500);assert.equal(await d.page.locator('#supportFollowHand').evaluate(e=>e.hidden),false);
      assert.equal(await d.page.locator('#supportFollowHand').getAttribute('data-target'),target);
      for(const at of [0,900,1600,2500])await d.capture('hand-'+target+'-'+at,{motionAt:at});
      await d.key('Escape');assert.equal(await d.page.locator('#supportFollowHand').evaluate(e=>e.hidden),true);
      await d.capture('hand-'+target+'-canceled');
      await d.page.evaluate(()=>supportFooterControl.offerAfterSuccess('Ready'));await d.tick(1500);
      assert.equal(await d.page.locator('#supportFollowHand').evaluate(e=>e.hidden),true);
    }
  }],
  ['reduced-motion',async d=>{
    await d.page.emulateMedia({reducedMotion:'reduce'});await d.fresh();await d.hover('#languageSelectTrigger');await d.capture('reduced-controls');
    await d.focus('#languageSelectTrigger');await d.key('Space');await d.key('ArrowDown');await d.key('Enter');
    assert.equal((await d.state()).language,'zh-Hant');await d.capture('reduced-selection-state');
    await d.page.evaluate(()=>{operationLog.start('Applying language');operationLog.upsert({id:'apply',title:'Applying translation',state:'running',urgent:true});});
    await d.capture('reduced-spinner-shimmer');
    await d.toast([{title:'Reduced motion',type:'info'}]);await d.key('F6');await d.page.evaluate(()=>__testToast.close(__toastIds[0]));
    await d.capture('reduced-toast-closing');await d.tick(550);await d.capture('reduced-toast-closed');
    await d.page.evaluate(()=>{operationLog.complete('Ready');supportFooterControl.offerAfterSuccess('Ready');});await d.tick(1500);
    assert.equal(await d.page.locator('#supportFollowHand').evaluate(e=>e.hidden),true);await d.capture('reduced-no-hand');
  }],
  ['toast-background',async d=>{
    await d.fresh();await d.toast([{title:'Background pause',type:'info'}],1500);await d.capture('background-ready');
    // Playwright强制所有页有焦点；用同一fixture输入验证两套机器的blur/focus。
    await d.page.evaluate(()=>{window.__fixtureFocus=false;Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>window.__fixtureFocus});window.dispatchEvent(new Event('blur'));});
    assert.equal(await d.page.evaluate(()=>document.hasFocus()),false);await d.tick(2200);
    assert.equal((await d.state()).toasts.length,1);await d.capture('background-paused');
    await d.page.evaluate(()=>{window.__fixtureFocus=true;window.dispatchEvent(new Event('focus'));});
    await d.tick(2200);assert.equal((await d.state()).toasts.length,0);await d.capture('background-resumed');
  }],
];
module.exports = { cases };
