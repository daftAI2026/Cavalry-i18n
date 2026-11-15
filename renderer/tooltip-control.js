/**
 * [INPUT]: SDK Core Tooltip root及原有工厂参数。
 * [OUTPUT]: 原open/close接口；公开for连接保留main的body portal，Core parts保持分组、焦点、指针与定位时序。
 * [POS]: 仅接线SDK，不维护第二份Tooltip状态或事件处理器。
 * [PROTOCOL]: 变更时更新此头部，然后检查CLAUDE.md
 */
(function attachTooltipControl(global) {
  'use strict';
  function createTooltipControl({root,popup}) {
    popup.setAttribute('for',root.id);
    document.body.append(popup);
    return Object.freeze({open:reason=>root.api.open(reason),close:()=>root.api.close()});
  }
  global.createTooltipControl=createTooltipControl;
})(window);
