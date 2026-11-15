/**
 * [INPUT]: UI SDK公开Core组合API、原生dialog及main的已验证行为。
 * [OUTPUT]: 保持main搜索/外点策略和virtual-focus Select、原生模态焦点、main顺序Toast及纯展示组件的SDK parts。
 * [POS]: 构建期组件定义；定制差异使用公开Core，不修改或读取SDK内部状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { definePrimitive, createListbox, isTypeaheadKey } from '@ui-sdk/core';
import { toastRegion } from '@ui-sdk/core/toast';
import { createParts, wrappedButton } from '@ui-sdk/web';

// 使用SDK原有Toast primitive，仅把Web默认的倒序DOM改成main的追加顺序。
// 公开render hook订阅primitive；队列、计时、暂停、堆叠和关闭仍归SDK。
createParts(toastRegion, {
  root: {tag:'ui-toast-region',self:'region',display:'block',properties:['renderToast'],
    options:el=>({placed:true,label:el.getAttribute('aria-label')}),api:['pause','resume'],
    render(el,instance) {
      const rendered=new Map(),previous=new WeakMap();
      function render() {
        const items=[...instance.get().items].sort((a,b)=>a.toast.order-b.toast.order);
        const ids=new Set(items.map(item=>item.toast.id));
        for(const [id,node]of rendered)if(!ids.has(id)){node.remove();rendered.delete(id);}
        for(const {toast}of items){
          let node=rendered.get(toast.id);
          if(!node){node=el.querySelector('template').content.cloneNode(true).querySelector('ui-toast');node.setAttribute('toast',toast.id);rendered.set(toast.id,node);}
          if(previous.get(node)!==toast){
            node.querySelector('ui-toast-title').textContent=toast.title||'';
            node.querySelector('ui-toast-description').textContent=toast.description||'';
            el.renderToast?.(toast,node);previous.set(node,toast);
          }
          if(!node.isConnected)el.append(node);
        }
      }
      render();return instance.subscribe(render);
    },
  },
  toast:{tag:'ui-toast',slot:'root',display:'contents',context:el=>({id:el.getAttribute('toast')})},
  title:{tag:'ui-toast-title',display:'block'},
  description:{tag:'ui-toast-description',display:'block'},
  close:{tag:'ui-toast-close',display:'contents',target:wrappedButton},
});

const select = definePrimitive({
  name: 'cavalry-select',
  options: { disabled: 'boolean', onValueChange: 'callback', onOpenChange:'callback' },
  state: options => ({ disabled: !!options.disabled, open: false, value: '', highlighted: null }),
  api(context) {
    const { store, element } = context;
    const listbox = createListbox(context, { key: 'highlighted', focus: 'virtual', loop: () => true });
    let typeahead = '', typeaheadTimer;
    context.onDestroy(()=>clearTimeout(typeaheadTimer));
    const items = () => [...context.parts()].filter(part => part.slot === 'item' && part.el?.isConnected);
    function setOpen(open) {
      open = open && !store.get().disabled;
      if (open === store.get().open) return;
      if (open) {
        const available = items().filter(part => !part.props.disabled);
        const selected = available.find(part => part.props.value === store.get().value);
        listbox.highlight((selected || available[0])?.key ?? null);
      }
      store.set({ open });
      context.options().onOpenChange?.(open,{reason:'imperative'});
    }
    function choose(key) {
      const part=items().find(part=>part.key===key);
      if (!part || part.props.disabled || store.get().disabled) return;
      store.set({ value: part.props.value }); setOpen(false);
      context.options().onValueChange?.(part.props.value, { reason:'item-press' });
      element('trigger')?.focus();
    }
    function keydown(event) {
      const state=store.get(),key=event.key;
      if(state.disabled)return;
      if(key==='Tab'){setOpen(false);return;}
      if(key==='Escape'){if(state.open)event.preventDefault();setOpen(false);return;}
      if(key==='Enter'||key===' '){event.preventDefault();state.open?choose(state.highlighted):setOpen(true);return;}
      if(['ArrowDown','ArrowUp','Home','End'].includes(key)){
        event.preventDefault();if(!state.open)setOpen(true);
        if(key==='Home'||key==='End')listbox.move(key==='Home'?'first':'last',event);
        else if(state.open)listbox.move(key==='ArrowDown'?1:-1,event);
        return;
      }
      if(isTypeaheadKey(event)) {
        if(!state.open)setOpen(true);
        clearTimeout(typeaheadTimer);typeahead+=key.toLocaleLowerCase();
        const available=items(),current=available.findIndex(part=>part.key===store.get().highlighted);
        // main每个字符都从当前项之后搜索；保留原策略，不引入SDK的重复字母循环。
        for(let step=1;step<=available.length;step++){
          const part=available[(current+step+available.length)%available.length];
          if(!part.props.disabled && part.props.label.toLocaleLowerCase().startsWith(typeahead)){listbox.highlight(part.key,{event});break;}
        }
        typeaheadTimer=setTimeout(()=>{typeahead='';},500);
      }
    }
    return { listbox, choose, keydown, activeElement:()=>items().find(part=>part.key===store.get().highlighted)?.el,isOpen:()=>store.get().open,setOpen,
      setDisabled(disabled){store.set({disabled});if(disabled)setOpen(false);},
      getValue:()=>store.get().value,
      setValue(value){store.set({value:value || ''});},
    };
  },
  slots: slot => ({
    root: slot({ attrs: () => ({}) }),
    trigger: slot({ role:'combobox',focus:'native',
      attrs:(state,{api})=>({'aria-expanded':String(state.open),'aria-haspopup':'listbox','aria-controls':'languageSelectPopup',
        'aria-activedescendant':state.open?api.listbox.activeId(state):undefined,disabled:state.disabled?'':undefined}),
      press:({api})=>api.setOpen(!api.isOpen()),
      on:{keydown:(event,{api})=>api.keydown(event)},
    }),
    content:slot({ role:'listbox',focus:'active-descendant', present:state=>state.open,
      attrs:()=>({}),
      bind(el,{api,store}) {
        const trigger=el.closest('cv-select').querySelector('button');
        const selected=el.querySelector('[data-selected]');
        const active=api.activeElement();
        const target=selected?active:el.querySelector('.select-popup-placeholder');
        // main在原布局上下文对齐；fixed/top-layer会改变阴影的栅格化结果。
        el.style.top='0px';
        const anchor=trigger.getBoundingClientRect(),row=target?.getBoundingClientRect();
        if(row)el.style.top=`${anchor.top+anchor.height/2-row.top-row.height/2}px`;
        const root=el.closest('cv-select');
        const outside=event=>{if(!root.contains(event.target))api.setOpen(false);};
        document.addEventListener('pointerdown',outside,true);
        return()=>{el.style.removeProperty('top');document.removeEventListener('pointerdown',outside,true);};
      },
    }),
    item:slot({ props:{value:'string',label:'string',disabled:'boolean'},role:'option',focus:'active-descendant',
      attrs:(state,part)=>({...part.api.listbox.attrs(state,part),
        'data-highlighted':state.open && state.highlighted===part.key?'':undefined,
        'aria-selected':String(state.value===part.props.value),'data-selected':state.value===part.props.value?'':undefined,
        'data-disabled':part.props.disabled?'':undefined}),
      on:{pointermove:(event,{api,key,props})=>{if(!props.disabled)api.listbox.highlight(key,{event});},
        pointerdown:event=>event.preventDefault()},
      press:({api,key})=>api.choose(key),
      bind:(el,part)=>part.api.listbox.bind(el,part),
    }),
  }),
});
createParts(select,{
  root:{tag:'cv-select',api:['setValue','getValue','setDisabled','setOpen','isOpen'],display:'block',
    state:{value:{get:api=>api.getValue(),set:(api,value)=>api.setValue(value)},open:{get:api=>api.isOpen(),set:(api,value)=>api.setOpen(value)}}},
  trigger:{tag:'cv-select-trigger',target:wrappedButton,display:'contents'},
  content:{tag:'cv-select-content',display:'block'},
  item:{tag:'cv-select-item',display:'block'},
});

const dialog = definePrimitive({
  name:'cavalry-alert-dialog',options:{onOpenChangeComplete:'callback'},
  state:()=>({open:false}),
  api({store,element,options}){
    let returnFocus;
    return { isOpen:()=>store.get().open,
      setOpen(open){
        if(open===store.get().open)return;
        const content=element('content');store.set({open});
        if(open){returnFocus=document.activeElement;content.showModal();content.querySelector('#modalPrimaryButton').focus();}
        else{content.close();returnFocus?.focus();options().onOpenChangeComplete?.(false);}
      },
    };
  },
  slots:slot=>({root:slot({attrs:()=>({})}),content:slot({role:'alertdialog',focus:'native',attrs:()=>({'aria-modal':'true'}),on:{cancel:event=>event.preventDefault()}})}),
});
createParts(dialog,{
  root:{tag:'cv-alert-dialog',display:'contents',state:{open:{get:api=>api.isOpen(),set:(api,value)=>api.setOpen(value)}},api:['isOpen','setOpen']},
  content:{tag:'cv-alert-dialog-content',display:'contents'},
});

let activeTooltip;
const tooltip=definePrimitive({
  name:'cavalry-tooltip',state:()=>({open:false,reason:'none'}),
  api(context){
    const {store,element}=context;
    function place(){
      const root=element('root'),popup=element('content');
      if(!store.get().open || !root || !popup)return;
      const styles=getComputedStyle(document.documentElement),pixel=name=>Number.parseFloat(styles.getPropertyValue(name))||0;
      const anchor=root.getBoundingClientRect(),layer=popup.getBoundingClientRect();
      const gap=pixel('--tooltip-side-offset'),padding=pixel('--tooltip-collision-padding');
      const bottom=anchor.bottom+gap,top=anchor.top-gap-layer.height;
      const side=bottom+layer.height+padding<=innerHeight || top<padding?'bottom':'top';
      const left=Math.min(Math.max(anchor.left+(anchor.width-layer.width)/2,padding),innerWidth-padding-layer.width);
      popup.dataset.side=side;popup.dataset.align='center';popup.style.left=`${left}px`;
      popup.style.top=`${side==='bottom'?bottom:top}px`;
      popup.style.setProperty('--tooltip-arrow-inline',`${anchor.left+anchor.width/2-left}px`);
    }
    const api={place,contentId:()=>element('content')?.id,
      open(reason='programmatic'){
        if(element('root')?.hidden || element('trigger')?.disabled)return;
        if(activeTooltip && activeTooltip!==api)activeTooltip.close();
        store.set({open:true,reason});activeTooltip=api;place();
      },
      close(){store.set({open:false,reason:'none'});if(activeTooltip===api)activeTooltip=null;},
    };
    return api;
  },
  slots:slot=>({
    root:slot({attrs:state=>({'data-tooltip-state':state.open?'open':'closed','data-tooltip-reason':state.reason}),
      on:{pointerenter:(event,{api})=>{if(event.pointerType!=='touch')api.open('hover');},pointerleave:(_,{api})=>api.close(),
        focusin:(_,{api})=>api.open('focus'),focusout:(event,{el,api})=>{if(!el.contains(event.relatedTarget))api.close();}},
      bind:(_,{api})=>{window.addEventListener('resize',api.place);return()=>window.removeEventListener('resize',api.place);},
    }),
    trigger:slot({attrs:(state,{api})=>({'data-popup-open':state.open?'':undefined,
        'aria-describedby':state.open?api.contentId?.():undefined}),
      press:({api})=>api.close(),on:{keydown:(event,{api})=>{if(event.key==='Escape')api.close();}},
    }),
    content:slot({role:'tooltip',attrs:state=>({'data-state':state.open?'open':'closed','data-reason':state.reason,'aria-hidden':String(!state.open)})}),
    arrow:slot({attrs:()=>({'aria-hidden':'true'})}),
  }),
});
createParts(tooltip,{root:{tag:'cv-tooltip',api:['open','close']},trigger:{tag:'cv-tooltip-trigger',target:wrappedButton,display:'contents'},
  content:{tag:'cv-tooltip-content',display:'inline-flex'},arrow:{tag:'cv-tooltip-arrow',display:'block'}});

// 无现成等价件的纯展示组件以Core parts保留现有语义、样式和状态属性。
// 不赋予原来没有的点击、焦点或键盘行为。
for(const name of ['badge','item','icon','marker','message','spinner','shimmer','task-panel','window-frame','window-controls','about','support-footer','follow-hand']) {
  const primitive=definePrimitive({name:`cavalry-${name}`,
    options:{dataState:'string',dataKind:'string',dataMode:'string'},
    state:options=>({state:options.dataState,kind:options.dataKind,mode:options.dataMode}),
    sync:options=>({state:options.dataState,kind:options.dataKind,mode:options.dataMode}),
    api:()=>({}),slots:slot=>({root:slot({attrs:()=>({'data-sdk-component':name,
      role:({'task-panel':'region','window-frame':'banner',about:'main','support-footer':'contentinfo'})[name]})})}),
  });
  createParts(primitive,{root:{tag:`cv-${name}`,display:'inline'}});
}
