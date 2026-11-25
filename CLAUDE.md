# feizon 仓库规则

## 提交
- 未经我明确要求，不要 commit 或 push。做完后告诉我改了什么，由我决定是否提交。
- 需要提交时，只提交源码、脚本和配置；不要提交渲染产物。

## 大文件
- 渲染出的视频（mp4 等）、大音频和其他大文件不要放进仓库。
- 成品上传到 Google Drive：用 rclone 的 `gdrive:` 远端（配置来自环境变量 `RCLONE_CONFIG_GDRIVE_*`），例如
  `rclone copy final/ gdrive:Claude视频/<项目名>/ -P`
- 云端容器会被回收，会话结束前确认成品已经传到 Drive。
