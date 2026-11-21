# ¿Cómo como? · 仓鼠和柴犬的西语绕口令

一支约 51 秒的 3D 萌宠短片（16:9，1920×1080，30fps），**完全用代码生成**：Three.js 场景与角色、镜头、字幕、配乐、音效都由程序合成，配音由 Gemini TTS 生成。

套路：「西班牙语很简单吧？」→ 快问快答一串同音词 → 拼成一句绕口令 → 雷鬼动说唱一口气唱完 → 结尾反转。

成片：[`final/como-como.mp4`](final/como-como.mp4)

## 角色

- **Hammy**（金色圆仓鼠，红色贝雷帽）：提问的一方，尖细可爱的卡通音（原声升 7 个半音）
- **Shiba**（胖柴犬，红色领巾，半眯眼）：西语「专家」，低沉淡定（原声降约 2 个半音），说唱时戴墨镜

场景：西班牙小吧台，背景墙是蓝白花砖（azulejo），柜台上放着一罐 **PIPAS**（葵花籽），结尾的笑点就是它。

## 台词

| 时间 | 角色 | 台词 | 字幕 |
|---|---|---|---|
| 0.9s | Shiba | Spanish is easy, right? | 西班牙语很简单的 |
| 3.6s | Hammy | Oh really? How do you say "how" in Spanish? | 那"怎么"用西班牙语怎么说？ |
| 6.8–16.6s | 快问快答 | how → **cómo**，I eat → **como**，like → **como**，since → **como**，about ten → **como diez** | |
| 16.9–23.4s | | How do I eat? → **¿Cómo como?**；I eat like I eat! → **Como como como.** | |
| 23.9s | Hammy | Okay, try this! What do you mean, how do I eat? Since I eat like I eat... I eat about ten! | 出题 |
| 31.4s | | 唱片刮擦声，柴犬转向镜头，墨镜落下 | |
| 32.5s | | 鼓点进入，环形文字绕头旋转，彩色灯光 | |
| 35–45s | Shiba（说唱） | ¿Cómo que cómo como? / Como como como como, / como como diez. / ¿Cómo como? ¡Como como como! | 卡拉 OK 逐词高亮 |
| 45.3s | | 仓鼠从 PIPAS 罐里一颗颗吃了「大约十个」（como diez）瓜子，腮帮子鼓起，boing！ | |
| 48.4s | | 片尾卡：¿Cómo como? ¡Como como como! | |

## 技术管线

```
script.json ─> scripts/tts.py          Gemini TTS，每句单独请求（纯文本，不带指令，避免被读出来）
            └> scripts/build_audio.py  rubberband 变调/EQ → 排时间轴 → numpy 合成配乐与音效 → 混音
                   ├─ timeline.json    唯一时间源（台词、节拍、各事件时间点）
                   ├─ src/data.js      时间轴 + 每个角色的口型包络（60Hz）
                   └─ audio/mix.wav
src/main.js ─> scripts/render.js       无头 Chromium（SwiftShader WebGL）逐帧渲染 → ffmpeg
scripts/mux.sh                         拼接分段 + 混入音轨 → final/como-como.mp4
```

- 每一帧都是时间 `t` 的纯函数（眨眼、灯光、瓜子轨迹都是确定性的），所以可以分段并行渲染、任意抽帧预览。
- 配乐：前半段是尼龙弦吉他（Karplus-Strong 合成）弹安达卢西亚终止式 Am–G–F–E，后半段是 96 BPM 的 dembow 雷鬼动节奏。说唱的每一句都卡在小节线上，人声出现时音乐自动压低（ducking）。
- 角色用球体加顶点色拼出软胶玩偶质感（MeshPhysicalMaterial 的 sheen 和 clearcoat），加上 ACES 色调映射和 BokehPass 景深。

## 复现

```bash
npm install
python3 scripts/tts.py            # 需要 Gemini API（GEMINI_KEY_FILE 或代理注入）
python3 scripts/build_audio.py    # 需要 numpy、scipy，以及带 rubberband 的 ffmpeg
node scripts/render.js --stills 2,18.5,36.2          # 抽帧预览 → out/stills/
for i in 0 1 2; do node scripts/render.js --from $((i*516)) --to $(((i+1)*516)) --out seg$i.mp4 & done; wait
bash scripts/mux.sh
```
