import { useState, useRef, useCallback } from "react";
import { Mic, Type, Pause, Play, Send, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { processHandoff, HandoffSummaryResponse } from "@/lib/api/patients";

type Mode = "idle" | "mic" | "text";
type MicState = "recording" | "paused";

interface PatientInputCellProps {
  /** Numeric backend patient ID (as string to stay compatible with URL params) */
  patientId: string;
}

interface SubmitResult {
  type: "success" | "error";
  message: string;
}

export const PatientInputCell = ({ patientId }: PatientInputCellProps) => {
  const [mode, setMode] = useState<Mode>("idle");
  const [micState, setMicState] = useState<MicState>("recording");
  const [textValue, setTextValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const clearResult = () => setTimeout(() => setResult(null), 4000);

  // ── Text submit ───────────────────────────────────────
  const submitText = useCallback(async () => {
    if (!textValue.trim()) return;
    setIsSubmitting(true);
    try {
      const res: HandoffSummaryResponse = await processHandoff(
        Number(patientId),
        textValue.trim()
      );
      setResult({
        type: "success",
        message: `Handoff processed · Risk: ${res.risk_level}`,
      });
      setMode("idle");
      setTextValue("");
      clearResult();
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Submission failed",
      });
      clearResult();
    } finally {
      setIsSubmitting(false);
    }
  }, [patientId, textValue]);

  const cancelText = () => {
    setMode("idle");
    setTextValue("");
  };

  // ── Mic controls ──────────────────────────────────────
  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
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
      clearResult();
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
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;

    const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
    chunksRef.current = [];

    if (blob.size === 0) {
      setMode("idle");
      setMicState("recording");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("patient_id", patientId);

      // Audio endpoint — same proxy as text
      const res = await fetch("/api/handoffs/upload", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("pg_token") ?? ""}`,
        },
      });
      if (!res.ok) throw new Error(await res.text());
      setResult({ type: "success", message: "Audio handoff submitted" });
      clearResult();
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
      clearResult();
    } finally {
      setIsSubmitting(false);
      setMode("idle");
      setMicState("recording");
    }
  }, [patientId]);

  const cancelMic = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setMode("idle");
    setMicState("recording");
  }, []);

  // ── Render ────────────────────────────────────────────

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
        <span className="truncate max-w-[180px]">{result.message}</span>
      </div>
    );
  }

  if (mode === "text") {
    return (
      <div className="flex items-start gap-2 min-w-[240px]">
        <Textarea
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder="Enter handoff notes…"
          className="h-16 min-h-[40px] text-sm resize-none py-1.5"
          rows={2}
          disabled={isSubmitting}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              submitText();
            }
          }}
        />
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={submitText}
            className="h-8 px-2"
            disabled={isSubmitting || !textValue.trim()}
          >
            <Send size={14} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={cancelText}
            className="h-8 px-2 text-muted-foreground"
            disabled={isSubmitting}
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    );
  }

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
          {isSubmitting ? "Uploading…" : micState === "recording" ? "Recording…" : "Paused"}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={togglePause}
          className="h-8 px-2"
          disabled={isSubmitting}
        >
          {micState === "recording" ? <Pause size={14} /> : <Play size={14} />}
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={sendMic}
          className="h-8 px-2"
          disabled={isSubmitting}
        >
          <Send size={14} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={cancelMic}
          className="h-8 px-2 text-destructive"
          disabled={isSubmitting}
        >
          <X size={14} />
        </Button>
      </div>
    );
  }

  // idle
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={startMic} className="h-8 px-3 gap-1.5">
        <Mic size={14} />
        <span className="text-xs">Mic</span>
      </Button>
      <Button size="sm" variant="outline" onClick={() => setMode("text")} className="h-8 px-3 gap-1.5">
        <Type size={14} />
        <span className="text-xs">Text</span>
      </Button>
    </div>
  );
};
