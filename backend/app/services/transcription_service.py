from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from pathlib import Path

logger = logging.getLogger("backend.transcription_service")

STT_MODEL: str = os.getenv(
    "STT_MODEL", "mlx-community/whisper-large-v3-asr-fp16"
)

_FFMPEG_WAV_ARGS = [
    "-ac", "1",
    "-ar", "16000",    
    "-sample_fmt", "s16",  
    "-f", "wav",
]


class TranscriptionService:

    async def transcribe(self, audio_bytes: bytes, suffix: str = ".webm") -> str:
        """
        Accept raw audio bytes in any format, convert to WAV via ffmpeg,
        then run the mlx_audio STT model and return the transcript.
        """
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp = Path(tmp_dir)
            raw_path = tmp / f"input{suffix}"
            wav_path = tmp / "audio.wav"
            transcript_stem = tmp / "transcript"

            raw_path.write_bytes(audio_bytes)

            await self._convert_to_wav(str(raw_path), str(wav_path))

            return await self._run_stt(
                audio_path=str(wav_path),
                output_stem=str(transcript_stem),
            )

    # ──────────────────────────────────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────────────────────────────────

    async def _convert_to_wav(self, input_path: str, output_path: str) -> None:
        """
        Shell out to ffmpeg to convert any input audio format to a
        16 kHz, mono, PCM-s16le WAV file that Whisper requires.
        """
        cmd = [
            "ffmpeg",
            "-y",           # overwrite output if it exists
            "-i", input_path,
            *_FFMPEG_WAV_ARGS,
            output_path,
        ]

        logger.info("Converting audio → WAV | input=%s | output=%s", input_path, output_path)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )

        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            err = stderr.decode(errors="replace")
            logger.error("ffmpeg conversion failed | rc=%d | stderr=%s", proc.returncode, err)
            raise RuntimeError(f"Audio conversion failed (rc={proc.returncode}): {err[:400]}")

        logger.info("ffmpeg conversion complete | output=%s", output_path)

    async def _run_stt(self, audio_path: str, output_stem: str) -> str:
        cmd = [
            "python", "-m", "mlx_audio.stt.generate",
            "--model", STT_MODEL,
            "--audio", audio_path,
            "--output-path", output_stem,
            "--format", "txt",
            "--gen-kwargs", '{"task": "translate"}',
        ]

        logger.info("Starting STT | model=%s | audio=%s", STT_MODEL, audio_path)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            error_msg = stderr.decode(errors="replace")
            logger.error("STT subprocess failed | rc=%d | stderr=%s", proc.returncode, error_msg)
            raise RuntimeError(f"STT failed (rc={proc.returncode}): {error_msg[:400]}")

        logger.info("STT finished | rc=0")
        return self._read_transcript(output_stem)

    @staticmethod
    def _read_transcript(output_stem: str) -> str:
        txt_path = Path(f"{output_stem}.txt")
        if not txt_path.exists():
            raise RuntimeError(f"STT output file not found: {txt_path}")
        return txt_path.read_text(encoding="utf-8").strip()


transcription_service = TranscriptionService()
