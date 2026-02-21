import { useState, useRef, useCallback } from "react";
import { Mic, Type, Pause, Play, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Mode = "idle" | "mic" | "text";
type MicState = "recording" | "paused";

interface PatientInputCellProps {
  patientId: string;
}

export const PatientInputCell = ({ patientId }: PatientInputCellProps) => {
  const [mode, setMode] = useState<Mode>("idle");
  const [micState, setMicState] = useState<MicState>("recording");
  const [textValue, setTextValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingBlobRef = useRef<Blob | null>(null);

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
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
        recordingBlobRef.current = blob;
        console.log(`Recording ready: ${(blob.size / 1024).toFixed(1)} KB`);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000); // collect chunks every second
      setMode("mic");
      setMicState("recording");
    } catch {
      console.error("Microphone access denied");
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
    
    // Upload the recording to the backend
    if (recordingBlobRef.current) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("audio", recordingBlobRef.current, "recording.webm");
        formData.append("patientId", patientId);
        
        const response = await fetch("/api/audio/upload", {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          console.log("Audio uploaded successfully");
          recordingBlobRef.current = null;
        } else {
          console.error("Failed to upload audio:", response.statusText);
        }
      } catch (error) {
        console.error("Error uploading audio:", error);
      } finally {
        setIsUploading(false);
      }
    }
    
    setMode("idle");
    setMicState("recording");
  }, [patientId]);

  const cancelMic = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    recordingBlobRef.current = null;
    console.log("Recording cancelled and data discarded");
    setMode("idle");
    setMicState("recording");
  }, []);

  const selectText = () => {
    setMode("text");
    setTextValue("");
  };

  const cancelText = () => {
    setMode("idle");
    setTextValue("");
  };

  if (mode === "text") {
    return (
      <div className="flex items-center gap-2 min-w-[220px]">
        <Textarea
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder="Enter notes…"
          className="h-9 min-h-[36px] text-sm resize-none py-1.5"
          rows={1}
        />
        <Button size="sm" variant="ghost" onClick={cancelText} className="text-xs text-muted-foreground">
          ✕
        </Button>
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
          {isUploading ? "Uploading…" : micState === "recording" ? "Recording…" : "Paused"}
        </span>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={togglePause} 
          className="h-8 px-2"
          disabled={isUploading}
        >
          {micState === "recording" ? <Pause size={14} /> : <Play size={14} />}
        </Button>
        <Button 
          size="sm" 
          variant="default" 
          onClick={sendMic} 
          className="h-8 px-2"
          disabled={isUploading}
        >
          <Send size={14} />
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={cancelMic} 
          className="h-8 px-2 text-destructive"
          disabled={isUploading}
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
      <Button size="sm" variant="outline" onClick={selectText} className="h-8 px-3 gap-1.5">
        <Type size={14} />
        <span className="text-xs">Text</span>
      </Button>
    </div>
  );
};
