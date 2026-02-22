import { useState, useRef, useCallback } from "react";
import {
  Mic,
  Type,
  Pause,
  Play,
  Send,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileAudio,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { processHandoff, HandoffSummaryResponse } from "@/lib/api/patients";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode =
  | "idle"
  | "mic"           // actively recording
  | "transcribing"  // STT in progress
  | "review"        // showing transcript for edit before submit
  | "text"          // manual text entry
  | "submitting";   // agent pipeline in flight

type MicState = "recording" | "paused";

interface PatientInputCellProps {
  /** Numeric backend patient ID (as string to stay compatible with URL params) */
  patientId: string;
}

interface SubmitResult {
  type: "success" | "error";
  message: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PatientInputCell = ({ patientId }: PatientInputCellProps) => {
  const [mode, setMode] = useState<Mode>("idle");
  const [micState, setMicState] = useState<MicState>("recording");
  const [transcriptText, setTranscriptText] = useState("");
  const [textValue, setTextValue] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const scheduleResultClear = () => setTimeout(() => setResult(null), 5000);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const resetToIdle = useCallback(() => {
    setMode("idle");
    setMicState("recording");
    setTranscriptText("");
    setTextValue("");
  }, []);

  const stopMediaTracks = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
  }, []);

  // ── Text submit ───────────────────────────────────────────────────────────

  const submitText = useCallback(async () => {
    const body = textValue.trim();
    if (!body) return;
    setMode("submitting");
    try {
      const res: HandoffSummaryResponse = await processHandoff(
        Number(patientId),
        body
      );
      setResult({
        type: "success",
        message: `Handoff processed · Risk: ${res.risk_level}`,
      });
      resetToIdle();
      scheduleResultClear();
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Submission failed",
      });
      setMode("text");
      scheduleResultClear();
    }
  }, [patientId, textValue, resetToIdle]);

  // ── Review/transcript submit ───────────────────────────────────────────────

  const submitTranscript = useCallback(async () => {
    const body = transcriptText.trim();
    if (!body) return;
    setMode("submitting");
    try {
      const res: HandoffSummaryResponse = await processHandoff(
        Number(patientId),
        body
      );
      setResult({
        type: "success",
        message: `Handoff processed · Risk: ${res.risk_level}`,
      });
      resetToIdle();
      scheduleResultClear();
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Agent pipeline failed",
      });
      setMode("review");
      scheduleResultClear();
    }
  }, [patientId, transcriptText, resetToIdle]);

  // ── Mic controls ──────────────────────────────────────────────────────────

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Browsers only reliably record in WebM. The backend converts to WAV via ffmpeg.
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setMode("mic");
      setMicState("recording");
    } catch {
      setResult({ type: "error", message: "Microphone access denied" });
      scheduleResultClear();
    }
  }, []);

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (micState === "recording") {
      recorder.pause();
      setMicState("paused");
    } else {
      recorder.resume();
      setMicState("recording");
    }
  }, [micState]);

  const sendMic = useCallback(async () => {
    // Collect final chunk before stopping
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.addEventListener("stop", () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      }, { once: true });
      recorder.stop();
    });

    stopMediaTracks();
    chunksRef.current = [];

    if (blob.size === 0) {
      resetToIdle();
      return;
    }

    setMode("transcribing");

    try {
      // Name the file so the backend extension hint resolves to .webm for ffmpeg conversion.
      const filename = blob.type.includes("webm") ? "recording.webm" : "recording.ogg";
      const formData = new FormData();
      formData.append("audio", blob, filename);

      const token = localStorage.getItem("pg_token") ?? "";
      const res = await fetch("/api/handoffs/transcribe-only", {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const data: { transcript: string } = await res.json();
      const transcript = data.transcript?.trim() ?? "";

      if (!transcript) {
        throw new Error("Transcription returned empty — audio may be too short or silent.");
      }

      setTranscriptText(transcript);
      setMode("review");
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Transcription failed",
      });
      resetToIdle();
      scheduleResultClear();
    }
  }, [stopMediaTracks, resetToIdle]);

  const cancelMic = useCallback(() => {
    stopMediaTracks();
    chunksRef.current = [];
    resetToIdle();
  }, [stopMediaTracks, resetToIdle]);

  // ── Render: result flash ──────────────────────────────────────────────────

  if (result) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs font-body px-2 py-1 rounded-md",
          result.type === "success"
            ? "bg-success/10 text-success"
            : "bg-destructive/10 text-destructive"
        )}
      >
        {result.type === "success" ? (
          <CheckCircle size={12} />
        ) : (
          <AlertCircle size={12} />
        )}
        <span className="truncate max-w-[240px]">{result.message}</span>
      </div>
    );
  }

  // ── Render: text mode ──────────────────────────────────────────────────────

  if (mode === "text") {
    return (
      <div className="flex items-start gap-2 min-w-[240px]">
        <Textarea
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder="Enter handoff notes…"
          className="h-16 min-h-[40px] focus:min-h-[120px] transition-all duration-200 text-sm resize-y py-1.5"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitText();
          }}
        />
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={submitText}
            className="h-8 px-2"
            disabled={!textValue.trim()}
          >
            <Send size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={resetToIdle}
            className="h-8 px-2 text-muted-foreground"
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: mic recording ──────────────────────────────────────────────────

  if (mode === "mic") {
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-2.5 w-2.5 rounded-full",
            micState === "recording" ? "bg-success animate-pulse" : "bg-destructive"
          )}
        />
        <span className="text-xs text-muted-foreground font-body">
          {micState === "recording" ? "Recording…" : "Paused"}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={togglePause}
          className="h-8 px-2"
        >
          {micState === "recording" ? <Pause size={14} /> : <Play size={14} />}
        </Button>
        <Button size="sm" variant="default" onClick={sendMic} className="h-8 px-2">
          <Send size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={cancelMic}
          className="h-8 px-2 text-destructive"
        >
          <X size={14} />
        </Button>
      </div>
    );
  }

  // ── Render: transcribing spinner ──────────────────────────────────────────

  if (mode === "transcribing") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
        <Loader2 size={14} className="animate-spin text-primary" />
        <FileAudio size={14} />
        <span>Transcribing audio…</span>
      </div>
    );
  }

  // ── Render: review transcript ─────────────────────────────────────────────

  if (mode === "review") {
    return (
      <div className="flex flex-col gap-2 min-w-[280px] max-w-[420px]">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
          <Edit3 size={12} />
          <span>Review transcript — edit if needed, then submit</span>
        </div>
        <Textarea
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          className="text-sm resize-y focus:min-h-[160px] transition-all duration-200 min-h-[72px]"
          rows={3}
        />
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={resetToIdle}
            className="h-8 px-2 text-muted-foreground"
          >
            <X size={14} />
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={submitTranscript}
            disabled={!transcriptText.trim()}
            className="h-8 px-3 gap-1.5"
          >
            <Send size={13} />
            <span className="text-xs">Submit</span>
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: submitting to agent ────────────────────────────────────────────

  if (mode === "submitting") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span>Running analysis…</span>
      </div>
    );
  }

  // ── Render: idle ───────────────────────────────────────────────────────────

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={startMic} className="h-8 px-3 gap-1.5">
        <Mic size={14} />
        <span className="text-xs">Mic</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setMode("text")}
        className="h-8 px-3 gap-1.5"
      >
        <Type size={14} />
        <span className="text-xs">Text</span>
      </Button>
    </div>
  );
};
