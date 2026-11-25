# THE HALL

网页版第一人称恐怖游戏（执法记录仪视角）。Three.js + WebGPU（自动回退 WebGL2），**零外部资产**：模型、贴图、音效全部在运行时程序化生成。

## 运行

```bash
npm install
npm run dev
```

打开终端里显示的地址（默认 http://localhost:5173 ）。建议 Chrome / Edge 最新版，佩戴耳机。

## 玩法

夜间巡逻，你被锁在 A 走廊里。

1. 找到 3 枚保险丝（涂鸦房的桌上、07 号泵房的木箱上，第 3 枚……试试售货机）。
2. 插进砖墙段的配电箱，恢复供电。
3. 走廊尽头的铁丝网门会打开，进入 LIFT B。

**它**会在你拿到第一枚保险丝后出现。它只在你**不看它**的时候移动；停电时就算看着它也会动——除非你的手电筒正照着它。被它碰到，录像中断。

| 按键 | 作用 |
| --- | --- |
| WASD / 方向键 | 移动 |
| Shift | 快走 |
| 鼠标 | 环顾 |
| E | 交互 / 阅读 / 关闭纸条 |
| F | 手电筒（耗电） |
| C | 六机位自动巡检演示 |
| Esc | 暂停 |

## URL 参数

- `?debug=1` 调参面板（曝光、雾、水洼阈值、反射、Bloom、鱼眼、色散、颗粒、冷暖光强）+ FPS
- `?shot=0..5` 冻结在 6 个参考机位之一（截图验收用），可加 `&flash`、`&entity&ex=0&ez=-10`
- `?webgl` 强制 WebGL2 后端
- `?hq` 像素比上限提高到 2

## 结构

```
src/
├── main.ts               入口、渲染器、主循环、debug 面板
├── proceduralTextures.ts Canvas 2D 生成的全部贴图与贴花
├── corridorBuilder.ts    走廊、房间、道具、灯光、TSL 水洼反射地面
├── cityscape.ts          窗外夜城（InstancedMesh + TSL 程序化窗格）、雨、天空
├── bodycamRig.ts         Pointer Lock、阻尼转向、步伐晃动、AABB 碰撞
├── postProcessing.ts     Bloom、桶形畸变、色散、暗角、噪点、信号故障
├── audioSystem.ts        Web Audio 合成环境声、脚步、嗡鸣、惊吓音效、电平
├── entity.ts             追猎者
├── game.ts               目标、交互、停电、死亡/结局、自动巡检
└── hud.ts                记录仪 HUD
```
