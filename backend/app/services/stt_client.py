
# import os
# import logging
# from typing import Optional

# import httpx

# logger = logging.getLogger("backend.stt_client")

# STT_SERVICE_URL: str = os.getenv("STT_SERVICE_URL", "http://localhost:8002")
# STT_TIMEOUT_SECONDS: int = int(os.getenv("STT_TIMEOUT_SECONDS", "120"))


# class SttClient:
#     """Thin async wrapper around the STT /transcribe endpoint."""

#     def __init__(self) -> None:
#         self._base_url = STT_SERVICE_URL

#     async def transcribe(self, audio_bytes: bytes, filename: str = "audio.wav") -> str:
#         """
#         Upload raw audio bytes to the STT service.

#         Returns the transcribed text string.
#         Raises httpx.HTTPStatusError on non-2xx responses.
#         """
#         logger.info(
#             "Calling STT service | url=%s/transcribe | bytes=%d | filename=%s",
#             self._base_url,
#             len(audio_bytes),
#             filename,
#         )
#         async with httpx.AsyncClient(timeout=STT_TIMEOUT_SECONDS) as client:
#             response = await client.post(
#                 f"{self._base_url}/transcribe",
#                 files={"file": (filename, audio_bytes, "audio/wav")},
#             )
#             response.raise_for_status()
#             data: dict = response.json()
#             text: str = data.get("text", "")
#             logger.info(
#                 "STT response | chars=%d | ms=%s",
#                 len(text),
#                 data.get("processing_time_ms", "?"),
#             )
#             return text


# stt_client = SttClient()
