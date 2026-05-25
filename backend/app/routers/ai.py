"""AI chat endpoint — proxies conversation to Claude."""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.deps import CurrentUserDep

router = APIRouter(prefix="/api/ai", tags=["ai"])

_SYSTEM_PROMPT = (
    "あなたは ArcSphere3D の 3D CAD アシスタントです。"
    "ユーザーの 3D モデリング操作（STL/IFC 読み込み、マテリアル編集、"
    "レイヤー管理、カメラ操作、キーボードショートカットなど）に関する質問に"
    "日本語で簡潔に答えてください。"
    "ArcSphere3D のキーボードショートカット: W=移動, E=回転, R=拡縮, Esc=選択解除。"
    "技術的な詳細が不明な場合は、一般的な 3D CAD の慣習に基づいて回答してください。"
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    content: str


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(body: ChatRequest, _current_user: CurrentUserDep) -> ChatResponse:
    api_key = os.environ.get("ANTHROPIC_API_KEY") or ""
    if not api_key:
        from app.config import get_settings

        api_key = get_settings().anthropic_api_key

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured (ANTHROPIC_API_KEY missing)",
        )

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)

        messages = [{"role": m.role, "content": m.content} for m in body.messages]

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=messages,
        )

        text = response.content[0].text if response.content else ""
        return ChatResponse(content=text)

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {exc}",
        ) from exc
