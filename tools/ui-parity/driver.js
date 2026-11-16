/**
 * [INPUT]: 同源审查夹具、真实renderer与显式暂停的Playwright Clock/Page。
 * [OUTPUT]: 对两种实现提供相同输入、桥记录、时钟和可观察状态/画面。
 * [POS]: 黑盒适配只消除实现标签和生成ID，不改业务、样式或预期结果。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const csp=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../src-tauri/tauri.conf.json'),'utf8')).app.security.csp;
const inventory=require('../ui_sdk_components.json');

const bridgeProbe = `
(() => {
 const base = window.cavalryI18n;
 const probe = window.__parity = { calls: [], holdApply: false, release: null, events: [] };
 window.cavalryI18n = Object.freeze({ ...base,
  getStatus: async (...args) => { const result=await base.getStatus(...args); probe.ready=true; return result; },
  applyLanguage: async (path, language, receive) => {
   probe.calls.push(['applyLanguage', language]);
   if (probe.holdApply) await new Promise(resolve => probe.release = resolve);
   return base.applyLanguage(path, language, event => { probe.events.push(event); receive?.(event); });
  },
  openProjectLink: async id => { probe.calls.push(['openProjectLink', id]); return base.openProjectLink(id); },
 });
})();`;

async function createDriver(context, origin, locale, dir, probe) {
  const page = await context.newPage();
  await page.addInitScript(() => { Math.random = () => 0.25; });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for(const routePath of ['app','about'])await page.route(`**/${routePath}?**`,async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace(/<base[^>]*>/,'').replace(/((?:src|href)=")\.\//g,'$1/renderer/');
    await route.fulfill({response,body,headers:{...response.headers(),'Content-Security-Policy':csp}});
  });
  await page.clock.install({ time: new Date('2026-11-15T03:59:00Z') });
  await page.clock.pauseAt(new Date('2026-11-15T04:00:00Z'));
  await page.route('**/fixture.js', async route => {
    const response = await route.fetch();
    const fault=probe==='state'?`\n(()=>{const base=window.cavalryI18n;window.cavalryI18n=Object.freeze({...base,applyLanguage:(path,language,receive)=>base.applyLanguage(path,language==='zh-Hant'?'ja_JP':language,receive)});})();`:'';
    await route.fulfill({ response, body: await response.text() + bridgeProbe + fault });
  });
  async function tick(ms = 50) { await page.clock.runFor(ms); }
  async function fresh(scenario = 'nativeOfficialDefaultEnglish', extra = '', about = false) {
    await page.goto(`${origin}/${about ? 'about' : 'app'}?scenario=${scenario}&locale=${locale}${extra}`);
    await tick(100);
    await page.waitForFunction(() => document.querySelector('#aboutVersion')?.textContent || window.__parity?.ready);
  }
  async function point(selector) {
    const box = await page.locator(selector).first().boundingBox();
    assert.ok(box, `${selector} has a visible hit target`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  async function hover(selector) { const p = await point(selector); await page.mouse.move(p.x, p.y); await tick(50); }
  async function click(selector) { const p = await point(selector); await page.mouse.click(p.x, p.y); await tick(50); }
  async function focus(selector) { await page.locator(selector).first().focus(); await tick(50); }
  async function key(key) { await page.keyboard.press(key); await tick(50); }
  async function choose(value = 'zh-Hant') {
    await click('#languageSelectTrigger');
    const label = { 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文', ja_JP: '日本語', en: 'English' }[value];
    const option = page.locator('.select-item').filter({ hasText: label }).first();
    const box = await option.boundingBox(); assert.ok(box, 'language option is visible');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await tick(100);
  }
  async function state() {
    return page.evaluate(() => {
      const q = selector => document.querySelector(selector);
      const text = e => e?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const referencedText = (element,attribute) => (element?.getAttribute(attribute)||'').split(/\s+/).filter(Boolean).map(id=>text(document.getElementById(id))).join(' ');
      const shown = e => !!e && !e.hidden && getComputedStyle(e).visibility !== 'hidden'
        && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
      const toasts = [...document.querySelectorAll('.toast')].filter(shown);
      const modal = q('#modalBackdrop');
      const active = document.activeElement;
      const activeOption=document.getElementById(q('#languageSelectTrigger')?.getAttribute('aria-activedescendant'));
      return {
        language: q('#languageSelect')?.value ?? null,
        trigger: text(q('#languageSelectValue')),
        placeholder:q('#languageSelectValue')?.dataset.placeholder,
        valueColor:q('#languageSelectValue')?getComputedStyle(q('#languageSelectValue')).color:null,
        expanded: q('#languageSelectTrigger')?.getAttribute('aria-expanded'),
        tooltips:[...document.querySelectorAll('.tooltip')].map(element=>({id:element.id,state:element.dataset.state,reason:element.dataset.reason,ariaHidden:element.getAttribute('aria-hidden'),bodyPortal:element.parentElement===document.body})),
        listboxLabel:q('#languageSelectTrigger')?.getAttribute('aria-expanded')==='true'?referencedText(q('[role=listbox]'),'aria-labelledby'):null,
        activeOption:text(activeOption),
        options:[...document.querySelectorAll('.select-item')].map(element=>({
          value:element.getAttribute('value')||element.dataset.value,disabled:element.getAttribute('aria-disabled')==='true',
          selected:element.getAttribute('aria-selected')==='true',highlighted:element.hasAttribute('data-highlighted')&&element.dataset.highlighted!=='false'})),
        selectDisabled: q('#languageSelectTrigger')?.disabled,
        applyDisabled: q('#applyButton')?.disabled,
        restoreDisabled: q('#restoreButton')?.disabled,
        currentLanguage: text(q('#currentLanguage')),
        outcomeRole:q('#statusOutcome')?.getAttribute('role')||null,
        logRole:q('#statusText')?.getAttribute('role')||null,
        activity: { mode: q('#statusPanel')?.dataset.mode, state: q('#statusPanel')?.dataset.state,
          intro: text(q('#statusIntro')), outcome: text(q('#statusOutcome')),
          rows: [...document.querySelectorAll('.operation-event')].map(e => ({ id: e.dataset.eventId,
            state: e.dataset.state, text: text(e) })) },
        modal: { visible: shown(modal), title: text(q('#modalTitle')), body: text(q('#modalBody')),
          primary: text(q('#modalPrimaryButton')), secondary: text(q('#modalSecondaryButton')) },
        permission: shown(q('#permissionButton')),
        reportIssue: shown(q('#reportIssueButton')),
        hand:{hidden:q('#supportFollowHand')?.hidden,target:q('#supportFollowHand')?.dataset.target||null,seen:localStorage.getItem('cavalry-i18n:follow-hand-seen')},
        focus: active?.closest('.toast') ? 'toast' : active?.id || active?.className || active?.tagName,
        focusedToast: active?.closest('.toast')?.querySelector('.toast-title')?.textContent || null,
        toasts: toasts.map(e => ({ title: text(e.querySelector('.toast-title')), description: text(e.querySelector('.toast-description')),
          role:e.getAttribute('role'),name:referencedText(e,'aria-labelledby'),details:referencedText(e,'aria-describedby'),type: e.dataset.type, ending: e.dataset.state === 'ending' || e.hasAttribute('data-ending-style') })).sort((a,b) => a.title.localeCompare(b.title)),
        calls: window.__parity?.calls || [], events: window.__parity?.events || [],
      };
    });
  }
  const checkpoints = [];
  const coverage={};
  async function capture(name, { visual = true, motionAt = null, omitFocus = false } = {}) {
    if (motionAt === null) await tick(32); // 稳定态给新文本两个绘制帧，中间帧仍用显式进度。
    await tick(0); // 清空本时刻到期的入场回调，再冻结动画取样。
    const frozenTime = await page.evaluate(()=>Date.now());
    await page.evaluate(async () => { await document.fonts.ready; document.documentElement.getBoundingClientRect(); });
    const freezeAnimations = () => page.evaluate(at => {
      for (const animation of document.getAnimations()) {
        if (at === null && Number.isFinite(animation.effect.getComputedTiming().endTime)) {
          animation.finish();
          // 暂停的时间线不会自然回收已完成的transition。撤掉这一层合成效果，
          // 让稳定态按相同的目标CSS重新栅格化；不改样式、不推进业务计时。
          if (animation instanceof CSSTransition) animation.cancel();
        }
        else { animation.pause(); animation.currentTime = at ?? 1000; }
      }
    }, motionAt);
    await freezeAnimations();
    const readGeometry = () => page.evaluate(() => {
      const selectors = ['.installation-item', '.badge', '.select-trigger', '.select-popup', '#applyButton', '#restoreButton',
        '.status-panel', '.status-viewport', '.modal-dialog', '.tooltip[data-state="open"]', '.support-footer', '.about-window'];
      const result = {};
      for (const selector of selectors) {
        const el = document.querySelector(selector); if (!el || !el.getBoundingClientRect().height) continue;
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        result[selector] = { x:r.x, y:r.y, width:r.width, height:r.height, font:s.font, color:s.color,
          background:s.backgroundColor, padding:s.padding, radius:s.borderRadius };
      }
      for (const el of document.querySelectorAll('.toast')) {
        const title=el.querySelector('.toast-title').textContent,r=el.getBoundingClientRect();
        result[`toast:${title}`]={x:r.x,y:r.y,width:r.width,height:r.height};
      }
      return result;
    });
    // 先读取当前帧排版，确保继承色/新替换的文本在截图前完成样式计算。
    await page.evaluate(async () => { await document.fonts.ready; document.documentElement.getBoundingClientRect(); });
    let file;
    if (visual) {
      file = `${name}.png`;
      // 与Playwright截图断言相同：连续两帧相同才取样，避免合成器尚未落稳。
      let previous, stable;
      for(let frame=0;frame<5;frame++){
        await freezeAnimations();
        const current=await page.screenshot({animations:'allow',caret:'initial'});
        if(previous?.equals(current)){stable=current;break;}
        previous=current;
      }
      assert.ok(stable, `${name}: screenshot must settle without changing input or clock`);
      fs.writeFileSync(`${dir}/${file}`,stable);
    }
    const geometry = await readGeometry();
    const observed = await state();
    assert.equal(await page.evaluate(()=>Date.now()),frozenTime,`${name}: capture must not advance the test clock`);
    if (omitFocus) delete observed.focus;
    checkpoints.push({ name, observed, geometry, file });
      const seen=await page.evaluate(entries=>entries.map(({name,selector,mode,factory})=>[name,[...document.querySelectorAll(selector)].some(element=>
      mode==='business'?element.isConnected:mode==='core-behavior'?typeof window.cavalryUi?.[factory]==='function'&&element.isConnected:
      !!customElements.get(element.localName) && (element.hasAttribute('data-slot') || element.firstElementChild?.hasAttribute('data-slot')))]),
      [...inventory.primitives,...inventory.compositions]);
    for(const [name,present]of seen)coverage[name]=coverage[name]||present;
    return observed;
  }
  async function toast(items, timeout = 5000, advance = 100) {
    await page.evaluate(({ items, timeout }) => {
      window.__testToast = createToastControl({ timeout });
      window.__toastIds = items.map(item => __testToast.show(item));
    }, { items, timeout });
    if(advance)await tick(advance);
  }
  async function rows(count = 20) {
    await page.evaluate(count => {
      operationLog.replace({ id:'first', title:'First task', state:'completed', urgent:true });
      for(let i=1;i<count;i++)operationLog.upsert({ id:'row-'+i, title:'Task '+i, state:'completed', urgent:true });
    }, count);
    await tick(100);
  }
  return { page, errors, checkpoints, coverage, fresh, tick, point, hover, click, focus, key, choose, state, capture, toast, rows };
}
module.exports = { createDriver };
