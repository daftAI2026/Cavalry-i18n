/**
 * [INPUT]: 原生ui-tooltip。
 * [OUTPUT]: 业务open/close投影；延迟、分组、定位和关闭交给SDK。
 * [POS]: 不维护第二套提示状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查CLAUDE.md。
 */
window.createTooltipControl = ({ root }) => Object.freeze({
  open() { root.open = true; },
  close() { root.open = false; },
});
