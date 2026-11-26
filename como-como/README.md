# Perro, pero, pelo, pera · 仓鼠和柴犬的西语绕口令

一支约 58 秒的 3D 萌宠短片（16:9，1920×1080，30fps），**完全用代码生成**：Three.js 场景、角色、镜头和字幕，numpy 合成的配乐与音效，Gemini TTS 配音。

成片：[`final/como-como.mp4`](final/como-como.mp4)（第 2 版。第 1 版「¿Cómo como?」可以在 git 历史里找到）

## 为什么第 2 版更上头

1. **用一串近音词，而不是同一个词**：perro（狗）、pero（但是）、pelo（毛）、pera（梨）、cerro（山丘）、hierro（铁）、puerro（韭葱）、barro（泥巴）。8 个意思完全不同、听起来几乎一样的词，越问越像在念咒。
2. **整段问答都卡在 100 BPM 的拍子上**：问题落在第 1 拍，回答落在第 3 拍，每个回答还配一个音阶逐级升高的马林巴音；最后两小节变成双倍速。
3. **副歌直接采样问答里的回答**：把柴犬答过的词剪成一拍一个，变调到弗拉门戈味的旋律上（A 落到 E 上再解决到 G#），再叠一层声码器。柴犬和仓鼠一人一句，最后一小节两人齐唱。
4. **主歌有和声员**：柴犬每唱完一句，仓鼠在第 4 拍喊出这句的最后一个词（¡cerro! ¡hierro! ¡barro!）。
5. **结尾反转**：「那……驴呢？」「Burro.」……柴犬慢慢转头：「Eres tú.（就是你。）」burro 在西语里也是"笨蛋"。仓鼠气鼓鼓，boing！

## 歌词

主歌（柴犬，一小节一句）：

> Pero el perro del cerro, *（¡cerro!）*
> tiene pelo de hierro, *（¡hierro!）*
> se come la pera
> y el puerro en el barro. *（¡barro!）*

副歌（一拍一个词）：

> 🐕 Perro, pero, pelo, pera
> 🐹 Cerro, hierro, puerro, barro
> 🐕 Perro, pero, pelo, pera
> 🐕🐹 Cerro, hierro, puerro, ¡barro!

## 时间线

| 时间 | 内容 |
|---|---|
| 0.6s | Shiba：Spanish is easy, right? |
| 3–19.7s | 卡拍问答：dog/but/fur/pear 每小节一对，hill/iron/leek/mud 双倍速 |
| 19.8–28s | Hammy 出题（英文念一遍整句），配张力吉他轮指 |
| 28.2s | 搓碟、柴犬转头、墨镜落下、军鼓 fill |
| 29.4–39s | 雷鬼动主歌，环形歌词绕头旋转，仓鼠在第 4 拍喊回声 |
| 39–48.6s | 副歌（808 低音、拍手、旋律主音） |
| 49–54s | burro 梗，仓鼠鼓腮，boing |
| 54.8s | 片尾卡 |

## 技术管线

```
script.json ─> scripts/tts.py          每个 take 一次请求，只发纯文本；多词 take 按停顿切成单词片段
            └> scripts/build_audio.py  100 BPM 网格排时间轴 → 角色变调/EQ → 副歌片段变调到旋律 + 声码器
                   │                    → numpy 合成吉他/dembow/808/音效 → 混音
                   ├─ timeline.json    唯一时间源
                   ├─ src/data.js      时间轴 + 口型包络
                   └─ audio/mix.wav
src/main.js ─> scripts/render.js       无头 Chromium（SwiftShader WebGL）逐帧渲染 → ffmpeg
scripts/mux.sh                         拼接分段 + 混入音轨 → final/como-como.mp4
```

TTS 的原始录音放在 `audio/raw/takes/`，切好的单词片段在 `audio/raw/clips/`。这些都提交进了仓库，因为免费额度每天只有少量请求，重新生成并不容易。

## 复现

```bash
npm install
python3 scripts/tts.py            # 需要 Gemini API；已有 takes 时会跳过，只重新切分
python3 scripts/build_audio.py    # 需要 numpy、scipy，以及带 rubberband 的 ffmpeg
node scripts/render.js --stills 5.6,40,52.8          # 抽帧预览 → out/stills/
for i in 0 1 2; do node scripts/render.js --from $((i*584)) --to $(((i+1)*584)) --out seg$i.mp4 & done; wait
bash scripts/mux.sh
```
