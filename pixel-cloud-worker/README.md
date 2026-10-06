# Claude Code 云端打工记 · Cloud Shift

一支约 57 秒的编辑风动态图形短片（kinetic typography + 几何图形），**完全用代码生成**：画面、动效、背景音乐、音效全部由程序合成，旁白由 Gemini TTS 生成。

视觉：黑 / 朱红 / 米白三色硬切，Inter Display 超粗体 + Newsreader 斜体衬线 + 思源黑体，红点主角，HUD 取景框，3D 粒子球，6× 时间超采样产生真实运动模糊。

成片：
- [`final/cloud-shift-4k.mp4`](final/cloud-shift-4k.mp4)：3840×2160 60fps 母版
- [`final/cloud-shift.mp4`](final/cloud-shift.mp4)：1920×1080 60fps，由 4K 母版 Lanczos 下采样

均为 H.264 + AAC，中英双语字幕。

## 分镜

| 时间 | 场景 | 内容 |
|---|---|---|
| 0–6.4s | 开机 | 终端启动、云层成形、集装箱"哐"地落地 |
| 6.4–13.2s | 接单 | 机器人醒来，收到"帮我做个像素风视频！" |
| 13.2–19.4s | git clone | 拉绳把仓库从云管道里拽出来，文件喷涌 |
| 19.4–25.6s | 写代码 | 键盘冒火花、WPM 飙到 9999、屏幕里出现自己 |
| 25.6–32.4s | 无头浏览器 | 真·没有头的相机连拍，帧数狂飙到 1710 |
| 32.4–38.8s | FFmpeg | 冲压机三连击，压出 MP4 胶卷并注入音轨 |
| 38.8–45.6s | git push | 3-2-1 倒数，火箭飞向 origin |
| 45.6–57s | 收尾 | 星芒烟花、"MADE IN THE CLOUD"，容器熄灯下班 |

## 技术管线

```
timeline.json ──┬─> src/*.js (Canvas 1920×1080 矢量动画，每帧 6 次子采样合成运动模糊)
                │      └─ scripts/render.js：Playwright 无头 Chromium 逐帧截图 → ffmpeg 编码
                ├─> scripts/audio.py：numpy 合成芯片 BGM + 40+ 种音效，按事件对齐并与人声混音/闪避
                └─> script.json → scripts/tts_batch.py：Gemini TTS 一次生成整段旁白 → 时间戳切分 + 转写校验
```

- `timeline.json` 是唯一的时间源：所有场景切换、动作事件和音效都从它读取，保证音画同步。
- 每一帧都是时间 `t` 的纯函数（粒子也是无状态的），所以可以任意并行、任意抽帧预览。

## 复现

```bash
# 1) 旁白（需要 Gemini API Key，放在仓库外的文件里）
GEMINI_KEY_FILE=/path/to/key python3 scripts/tts_batch.py
GEMINI_KEY_FILE=/path/to/key python3 scripts/split_take.py
# 2) 音频
python3 scripts/audio.py
# 3) 画面（可分段并行）
node scripts/render.js --from 0 --to 3420 --scale 2 --crf 13 --out seg0.mp4   # --scale 2 = 4K
# 预览某几帧
node scripts/render.js --stills 2.9,17.6,42.5
# 4) 合成
bash scripts/mux.sh
```

依赖：Node 22 + Playwright（Chromium）、Python 3 + numpy、ffmpeg，系统字体 Inter Display；其余字体（Newsreader、JetBrains Mono、Noto Sans/Serif SC 子集）在 `src/fonts/`。
