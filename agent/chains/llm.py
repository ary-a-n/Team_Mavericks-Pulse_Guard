import json
import logging
import os
import re
from typing import Any, Type, TypeVar

from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from tenacity import (
    after_log,
    before_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_fixed,
)

logger = logging.getLogger("agent.llm")

T = TypeVar("T", bound=BaseModel)

# ---------------------------------------------------------------------------
# Backend configuration
# Switch between MegaLLM cloud (primary) and local mlx_lm.server (fallback)
# ---------------------------------------------------------------------------

# -- MegaLLM cloud endpoint (clinical analysis — Layers 1-4) --
llm = ChatOpenAI(
    base_url="https://ai.megallm.io/v1",
    api_key=os.environ.get("MEGALLM_API_KEY", ""),
    model="openai-gpt-oss-20b",
    max_tokens=6000,
    temperature=0,
)

# -- Gemini 2.5 Flash Lite (Hinglish output — Layer 5) --
# Faster/lighter model for conversational text generation, not structured JSON
llm_fast = ChatOpenAI(
    base_url="https://ai.megallm.io/v1",
    api_key=os.environ.get("MEGALLM_API_KEY", ""),
    model="gemini-2.5-flash-lite",
    max_tokens=2048,
    temperature=0.3,   # slight creativity for natural Hinglish prose
)

# -- Local mlx_lm.server (commented out — use for offline / dev) --
# llm = ChatOpenAI(
#     base_url="http://localhost:11434/v1",
#     api_key="dummy",
#     model="mlx-community/II-Medical-8B-4bit",
#     max_tokens=4096,
#     temperature=0,
# )

def _parse_reasoning_output(raw: str, model_class: Type[T]) -> T:
    """
    Strip <think> blocks and Answer tags, extract JSON, parse into model_class.
    Safe for both reasoning models (with think tags) and standard models (without).
    """
    # 1. Remove <think>...</think> blocks
    text = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

    # 2. Strip <Answer> / </Answer> wrapper tags
    text = re.sub(r"</?[Aa]nswer>", "", text).strip()

    # 3. Extract from ```json ... ``` code fence if present
    code_fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if code_fence:
        text = code_fence.group(1).strip()

    # 4. Find the outermost JSON object { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    return model_class.model_validate_json(text)


async def invoke_structured(
    prompt_chain: Any,
    inputs: dict,
    model_class: Type[T],
) -> T:
    """
    Invoke prompt | llm, parse raw output into model_class, retry up to 3x.

    Usage:
        chain = some_prompt | llm        # NO with_structured_output
        result = await invoke_structured(chain, inputs, MyModel)
    """
    str_chain = prompt_chain | StrOutputParser()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_fixed(2),
        retry=retry_if_exception_type(Exception),
        before=before_log(logger, logging.DEBUG),
        after=after_log(logger, logging.WARNING),
        reraise=True,
    )
    async def _attempt() -> T:
        raw: str = await str_chain.ainvoke(inputs)
        logger.debug("Raw LLM output (first 300 chars): %s", raw[:300])
        return _parse_reasoning_output(raw, model_class)

    return await _attempt()


# Keep for backwards compatibility
async def invoke_with_retry(chain: Any, inputs: dict) -> Any:
    """Legacy helper — prefer invoke_structured for typed parsing."""
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_fixed(2),
        retry=retry_if_exception_type(Exception),
        before=before_log(logger, logging.DEBUG),
        after=after_log(logger, logging.WARNING),
        reraise=True,
    )
    async def _attempt() -> Any:
        return await chain.ainvoke(inputs)

    return await _attempt()
