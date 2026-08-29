/**
 * [INPUT]: 依赖 operation-log.js 的任务会话/事件投影能力与 app.js 注入的本地化文本函数，消费 tauri-bridge.js 归一化后的 downloading/installing/restarting 更新事件
 * [OUTPUT]: 对外提供 createUpdateProgress，把下载字节、安装边界与重启边界压缩为面向用户的三阶段任务视图，完成态分别投影 DownloadSimple 与 Package 语义图标；不暴露签名、URL、临时路径或内部函数名
 * [POS]: renderer 的 Updater 展示适配器，位于稳定后端事件 DTO 与通用任务事件视窗之间；只负责语义投影，不发起更新、不推进后端状态、不处理失败策略
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
(() => {
  function createUpdateProgress({ log, text }) {
    function downloadDescription({ downloaded, contentLength }) {
      if (!downloaded || !contentLength) return '';
      const percent = Math.min(100, Math.floor((downloaded / contentLength) * 100));
      return text('updateDownloadProgress', { percent });
    }

    function project(event, update) {
      if (event.phase === 'downloading') {
        log.upsert({
          id: 'updateDownload',
          title: text('updateDownloadRunningTitle', { version: update.version }),
          description: downloadDescription(event),
          state: 'running',
        });
        return;
      }
      if (event.phase === 'installing') {
        log.upsert({
          id: 'updateDownload',
          title: text('updateDownloadCompletedTitle'),
          state: 'completed',
          icon: 'download',
        });
        log.upsert({
          id: 'updateInstall',
          title: text('updateInstallRunningTitle'),
          state: 'running',
        });
        return;
      }
      if (event.phase === 'restarting') {
        log.upsert({
          id: 'updateInstall',
          title: text('updateInstallCompletedTitle'),
          state: 'completed',
          icon: 'package',
        });
        log.upsert({
          id: 'updateRestart',
          title: text('updateRestartRunningTitle'),
          state: 'running',
        });
      }
    }

    function start(update) {
      log.start({ title: text('updateTaskTitle', { version: update.version }) });
    }

    return Object.freeze({ start, project });
  }

  window.createUpdateProgress = createUpdateProgress;
})();
