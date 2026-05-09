# Chimera

> "我有两个BOT,一个是仁之BOT,一个是义之BOT。"

一个 OpenAI 兼容代理。让 [Airi](https://github.com/moeru-ai/airi)（身体）和 [MaiBot](https://github.com/MaiM-with-u/MaiBot)（大脑）共用一副躯壳。

---

## 为什么叫 Chimera

最初想叫 Frankenstein——脑子里第一个蹦出来的词。后来反应过来，弗兰肯斯坦是用死人尸体拼的，叫这个好像不太好（

Chimera（奇美拉）是希腊神话里的混种兽，狮头羊身蛇尾。基因来源各不相同，凑一块儿居然活得好好的——大概就是这个项目。

另外：[阿米娅是奇美拉](https://prts.wiki/w/阿米娅)，麦麦叫麦麦是因为麦哲伦。明日方舟浓度刚好。

还有我很喜欢的一张专辑也叫《Chimera》。

---

## 为什么会有这个项目

最初的想法很朴素：能不能搞个桌面 Live2D 角色，能聊天、有记忆、会动、会说话。

于是开始翻代码。翻完发现一个巧合：

| Airi 缺的 | MaiBot 刚好有 |
|-----------|--------------|
| 长期记忆（A-Memorix） | ✅ |
| 多 LLM 协同推理（Maisaka） | ✅ |
| 人格引擎 | ✅ |

| MaiBot 缺的 | Airi 刚好有 |
|------------|-----------|
| Live2D 渲染 | ✅ |
| TTS + 唇形同步 | ✅ |
| 语音输入 | ✅ |

**于是缝合开始。**

---

## 它做了什么

```
你在 Airi 里打字
      ↓
Airi：我把消息发给 OpenAI API 了！（它确实这么以为）
      ↓
Chimera：收到。翻译一下。喂，麦麦，有人找你。
      ↓
MaiBot：收到。（查记忆、推理、生成回复）
      ↓
Chimera：麦麦回了。翻译回 OpenAI 格式。Airi 拿去。
      ↓
Airi：收到回复！显示文字！播放语音！嘴巴动起来！表情换一下！
```

Airi 从来没怀疑过自己连的不是 OpenAI。
MaiBot 从来没怀疑过桌宠不是另一个 QQ 窗口。
Chimera 什么都知道，但什么都不说。

---

## 一键启动（已安装 Airi）

```bash
scripts\start.bat
```

按顺序启动 MaiBot → 代理 → Airi，等每个就绪再启动下一个。
停止：`scripts\stop.bat`

---

## 手动启动

## 快速开始

### 1. 确保 MaiBot 在运行

插件 `maibot-deskpet-plugin` 已加载，WebSocket 在 `ws://127.0.0.1:8523/ws`。

### 2. 给麦麦注入桌宠人格

把下面的内容追加到 MaiBot 的 `chat_config.toml`：

```toml
[[chat.chat_prompts]]
platform = "deskpet"
item_id = "deskpet-user"
rule_type = "private"
prompt = """
你是一个 Live2D 桌面宠物，正在和用户一对一私聊。
回复简短自然，像朋友一样。可以主动关心对方。
用 [emotion:name] 控制表情，可选: happy, sad, angry, surprise, thinking, shy, curious, neutral
"""
```

MaiBot 会自动识别 `platform=deskpet`，用这段提示词，跳过群聊的插话逻辑。

### 3. 启动代理

```bash
cd packages/airsaka-proxy
pnpm install
pnpm dev
```

跑在 `http://localhost:8524`。

### 4. 告诉 Airi "你的新 API 在这里"

在 Airi 的 Provider 设置里：

| 设置 | 值 |
|------|-----|
| Base URL | `http://localhost:8524` |
| API Key | 随意，代理不看 |
| Model | 随意，代理不挑 |

### 5. 说话

Airi 的 TTS、唇形、Live2D 表情——一切照旧工作。

---

## 环境变量

| 变量 | 默认 | 干吗的 |
|------|------|--------|
| `PORT` | `8524` | 代理端口 |
| `MAIBOT_WS_URL` | `ws://127.0.0.1:8523/ws` | 麦麦在哪 |

---

## API

代理实现了 OpenAI 接口的快乐简化版：

```
GET  /v1/models
POST /v1/chat/completions   ← 支持 stream: true
GET  /health
```

---

## 目录

```
chimera/
├── scripts/
│   ├── start.bat                 # 一键启动（MaiBot → 代理 → Airi）
│   └── stop.bat                  # 停止全部
├── packages/airsaka-proxy/       # 代理本体（约 300 行）
├── config/maibot/chat_prompts.toml
├── maibot-deskpet-plugin/        # 原有插件
└── README.md（你在这里）
```

---

## 许可

GPL-3.0。麦麦是什么许可我就是什么许可。
