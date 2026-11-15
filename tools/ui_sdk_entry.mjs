/**
 * [INPUT]: lock 固定的 UI SDK Web Components 与公开 createToaster API。
 * [OUTPUT]: 注册实际使用的组件，公开独立 Toast 队列工厂。
 * [POS]: 构建期 SDK 入口，不直接进入浏览器；由 build_ui_sdk.js 按需编译。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import './ui_sdk_primitives.mjs';
import '@ui-sdk/web/button';
import '@ui-sdk/web/scroll-area';
import '@ui-sdk/web/progress';
import { createToaster } from '@ui-sdk/web';

window.cavalryUi = Object.freeze({ createToaster });
