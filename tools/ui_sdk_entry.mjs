/**
 * [INPUT]: 含Dialog与ScrollArea公开entry； lock 固定的 UI SDK Web Components 与公开 createToaster API。
 * [OUTPUT]: 注册SDK原生组件，公开Toast队列和日志跟随工厂；状态机不在本项目重写。
 * [POS]: 构建期 SDK 入口，不直接进入浏览器；由 build_ui_sdk.js 按需编译。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import '@ui-sdk/web/button';
import '@ui-sdk/web/select';
import '@ui-sdk/web/tooltip';
import '@ui-sdk/web/alert-dialog';
import '@ui-sdk/web/dialog';
import '@ui-sdk/web/scroll-area';
import '@ui-sdk/web/toast';
import '@ui-sdk/web/progress';
import { createStickToBottom } from '@ui-sdk/core';
import { createToaster } from '@ui-sdk/web';

window.cavalryUi = Object.freeze({ createToaster, createStickToBottom });
