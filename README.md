# 鹈鹕快运 · The Pelican Express

一只十一公斤的鹈鹕，一辆二四速通勤车，和一整条会呼吸的海。

一页自包含的实时 3D 场景：**没有模型文件，没有贴图文件，没有音频文件**。鹈鹕、自行车、海浪、天空、柏油路、藤篮、鱼——全部在浏览器里用代码长出来；所有音效由 Web Audio 实时合成。整页只有一个 HTML 文件（外加一个 three.js 的 CDN import）。

## 打开

CDN：<https://raw.githack.com/LDGAGI/pelican-express/main/index.html>

本地：

```bash
node build.mjs          # src/ → dist/index.html（自检每个模块的语法）
python3 -m http.server 8731 --directory dist
# → http://127.0.0.1:8731/index.html
```

可分享的深链接（自动开始骑行）：

```
index.html?go=1&v=0.6&cam=0&phase=day
```

`v` 车速 0–1 · `cam` 0 跟拍 / 1 环绕 / 2 正脸 / 3 电影 / 4 自由 · `phase` day / dusk / night

## 玩法

| 操作 | |
|---|---|
| 拖动 | 环视（自动切到自由镜头） |
| 滚轮 / 双指 | 推拉 |
| 点击鹈鹕 | 张嘴接住海里跳上来的鱼 |
| `1`–`5` | 切换镜头 |
| `空格` | 刹车 / 起步 |
| `↑` `↓` | 加速 / 减速 |
| `N` | 白天 → 黄昏 → 夜晚 |
| `B` `S` `M` `L` | 按铃 / 墨镜 / 静音 / 海风电台 |
| `H` `R` | 隐藏界面 / 重新出发 |

## 技术

- **three.js r169**，只 import 核心包；后处理、控制器、地形全是自己写的。
- **手写 GLSL**：程序化天空穹顶（fbm 云、太阳/月亮、星空、闪电）、五波 Gerstner 海洋（解析法线、菲涅尔、太阳耀斑、近岸碎浪），全部在 fragment/vertex 里现算。
- **自建 HDR 后处理链**：4× MSAA half-float 渲染目标 → 亮度提取 → 两级可分离高斯 → ACES 色调映射 + 径向速度模糊 + 色差 + 暗角 + 胶片颗粒。不依赖 `examples/jsm` 里的任何 pass。
- **程序化几何**：车架由管件放样合并，28 根辐条按交叉编织排布，链条沿真实的公切线 + 包角路径逐节摆放；鹈鹕的喙是变截面放样，喉囊是带弹簧的次级动力学，脖子是 11 节可编程 S 形。
- **腿部 IK**：两骨解析解，膝盖朝前，脚掌始终踩在水平踏板上。
- **Verlet 围巾**、**顶点着色器风摆草叶**、**点精灵粒子**、**程序化跳鱼**。
- **Web Audio**：胎噪、风、海浪、链条吱呀、车铃、鸥鸣、雷声，外加一台可开关的"海风电台"（五声音阶琶音 + 铺底，全部合成）。
- **性能自适应**：帧率掉下来就自动降 DPR。

## 结构

```
src/
  index.template.html    页面骨架 + UI 结构
  style.css              设计系统（ink 底 / 珊瑚橙主色 / 青绿辅色）
  js/
    a_core.js            three 引导、调色板、世界尺度、昼夜预设
    b_utils.js           数学、弹簧、Verlet、放样、合并、程序化贴图
    c_shaders.js         GLSL：天空、海洋、布料、光束
    d_post.js            HDR 后处理链
    e_world.js           天空/海/路/沙滩/草丛/回收的景物带/灯光
    f_bike.js            自行车：车架、辐条、传动、藤篮、车灯、鱼旗
    g_pelican.js         鹈鹕：身体、脖子、喙与喉囊、翅膀、蹼足 IK
    h_fx.js              粒子池、跳鱼、接鱼特效
    i_audio.js           Web Audio 合成
    j_ui.js              DOM 绑定与快捷键
    k_main.js            渲染器、镜头导演、骑行动力学、主循环
tools/
  shoot.mjs              无头 Chrome 截图 / 控制台诊断（CDP）
  interact.mjs           交互冒烟测试（21 项）
build.mjs                内联打包 → dist/index.html
```

## 一个值得记下的坑

`computeVertexNormals()` 对**非索引**几何按 3 个顶点一组迭代。鱼尾巴原本是 4 个顶点的条带，于是最后一个顶点读到了越界数据，法线变成 `NaN`——一个 NaN 像素顺着亮度提取和高斯模糊扩散开，最后在画面上表现为一大块黑方块。

修法在两处：几何层面补成完整三角形（`src/js/f_bike.js`），后处理层面加一道 `greaterThanEqual` 兜底，任何非有限值都进不了 bloom 链（`src/js/d_post.js`）。
