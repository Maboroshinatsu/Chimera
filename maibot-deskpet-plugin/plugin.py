"""Chimera Plugin — MaiBot LLM WebSocket 桥接

纯文本桥接：WebSocket 接收消息 → ctx.llm.generate() → 返回文字。
Airi 负责全部渲染（表情、TTS、UI），本插件不参与。
"""

import json
import time
import uuid
from dataclasses import dataclass, field
from logging import Logger
from typing import Optional, Set

import websockets

from maibot_sdk import MaiBotPlugin, PluginConfigBase, Field


class WSServerConfig(PluginConfigBase):
    __ui_label__ = "WebSocket"
    __ui_icon__ = "wifi"
    __ui_order__ = 0
    host: str = Field(default="127.0.0.1", description="监听地址")
    port: int = Field(default=8523, description="监听端口")


class LLMConfig(PluginConfigBase):
    __ui_label__ = "LLM"
    __ui_icon__ = "cpu"
    __ui_order__ = 1
    model: str = Field(default="replyer", description="MaiBot 模型任务名（replyer/planner 等）")


class ChimeraPluginConfig(PluginConfigBase):
    plugin: PluginCoreConfig = Field(default_factory=lambda: PluginCoreConfig(enabled=True, config_version="1.0.0"))
    ws_server: WSServerConfig = Field(default_factory=WSServerConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)


class PluginCoreConfig(PluginConfigBase):
    __ui_label__ = "插件"
    __ui_icon__ = "package"
    __ui_order__ = 0
    enabled: bool = Field(default=True, description="是否启用插件")
    config_version: str = Field(default="1.0.0", description="配置版本")


@dataclass
class Message:
    type: str
    data: dict = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    request_id: Optional[str] = None

    def to_json(self) -> str:
        return json.dumps(
            {"type": self.type, "data": self.data, "timestamp": self.timestamp,
             "request_id": self.request_id},
            ensure_ascii=False,
        )

    @staticmethod
    def from_json(raw: str) -> "Message":
        obj = json.loads(raw)
        return Message(
            type=obj.get("type", ""),
            data=obj.get("data", {}),
            timestamp=obj.get("timestamp", time.time()),
            request_id=obj.get("request_id"),
        )


class ChimeraPlugin(MaiBotPlugin):
    config_model = ChimeraPluginConfig

    async def on_load(self) -> None:
        self._server = None
        self._clients: Set[websockets.WebSocketServerProtocol] = set()

        self._server = await websockets.serve(
            self._handle, self.config.ws_server.host, self.config.ws_server.port,
            ping_interval=30, ping_timeout=10,
        )
        self.ctx.logger.info(
            f"[Chimera] WS on ws://{self.config.ws_server.host}:{self.config.ws_server.port}"
        )

    async def on_unload(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def on_config_update(self, scope: str, config_data: dict, version: str) -> None:
        pass

    async def _handle(self, ws: websockets.WebSocketServerProtocol):
        self._clients.add(ws)
        try:
            async for raw in ws:
                msg = Message.from_json(raw)
                if msg.type == "ask":
                    await self._handle_ask(msg)
                elif msg.type == "heartbeat":
                    pass
        except websockets.ConnectionClosed:
            pass
        finally:
            self._clients.discard(ws)

    async def _handle_ask(self, msg: Message) -> None:
        text = msg.data.get("text", "").strip()
        if not text:
            return

        self.ctx.logger.info(f"[Chimera] Ask: {text[:80]}...")
        try:
            result = await self.ctx.llm.generate(
                prompt=text, model=self.config.llm.model,
            )
            response = result.get("response", "") if isinstance(result, dict) else str(result)
        except Exception as e:
            self.ctx.logger.error(f"[Chimera] LLM failed: {e}")
            response = f"[Error] {e}"

        await self._broadcast("text", {"text": response, "request_id": msg.request_id})

    async def _broadcast(self, msg_type: str, data: dict):
        msg = Message(type=msg_type, data=data).to_json()
        for ws in list(self._clients):
            try:
                await ws.send(msg)
            except websockets.ConnectionClosed:
                self._clients.discard(ws)


def create_plugin() -> ChimeraPlugin:
    return ChimeraPlugin()
