# Chimera — Airi ↔ MaiBot 桥接代理

OpenAI 兼容代理，让 [Airi](https://github.com/moeru-ai/airi) 使用 [MaiBot](https://github.com/MaiM-with-u/MaiBot) 作为 AI 大脑。

## 架构

```
Airi（Live2D 渲染 + TTS + UI）
  ↕ OpenAI /v1/chat/completions
  ↕ http://localhost:8524
airsaka-proxy（我们，～200 行）
  ↕ WebSocket
MaiBot（LLM 推理 + A-Memorix 记忆 + 人格引擎）
```

Airi 不改一行代码——把 provider baseURL 指向 `http://localhost:8524`。
MaiBot 不改一行代码——通过 `chat_prompts` 配置注入桌宠人格。

## 快速开始

### 1. 启动 MaiBot

确保插件 `maibot-deskpet-plugin` 已安装，WebSocket 运行在 `ws://127.0.0.1:8523/ws`

### 2. 配置 MaiBot 桌宠提示词

将 `config/maibot/chat_prompts.toml` 的内容追加到 MaiBot 的 `chat_config.toml`

### 3. 启动代理

```bash
cd packages/airsaka-proxy
pnpm install
pnpm dev
```

代理默认监听 `http://localhost:8524`

### 4. 配置 Airi

在 Airi 的 LLM 设置中，将 Provider baseURL 改为 `http://localhost:8524`，模型选 `maibot`

### 5. 开始对话

在 Airi 中输入消息 → 代理转发到 MaiBot → MaiBot 回复流式返回 → Airi 渲染 + TTS

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 8524 | 代理监听端口 |
| `MAIBOT_WS_URL` | ws://127.0.0.1:8523/ws | MaiBot WebSocket 地址 |

## 目录结构

```
chimera/
├── packages/
│   └── airsaka-proxy/       # OpenAI → MaiBot 桥接代理
├── config/
│   └── maibot/
│       └── chat_prompts.toml # 桌宠专用提示词
├── maibot-deskpet-plugin/    # 现有插件（保持维护）
├── MaiBot/                   # gitignored
└── airi-main/                # gitignored
```

## 许可

GPL-3.0，与 MaiBot 一致。
