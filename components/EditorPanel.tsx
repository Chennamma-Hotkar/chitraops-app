"use client";
import { useState, useEffect, useRef } from "react";
import {
  X, Film, Video, Mic, Music, Play, Square,
  Loader2, Download, CheckCircle2, AlertCircle,
} from "lucide-react";

interface EditorPanelProps {
  runwayTaskIds: string[];
  heygenVideoId: string | null;
  hasVoice:      boolean;
  hasMusic:      boolean;
  onClose:       () => void;
  onDone:        (url: string) => void;
}

type RenderState = "idle" | "polling" | "rendering" | "done" | "failed";

// Stable waveform heights (generated once, not on every render)
const WAVE_HEIGHTS_VOICE = Array.from({ length: 52 }, (_, i) =>
  20 + ((Math.sin(i * 0.4) + 1) * 30)
);
const WAVE_HEIGHTS_MUSIC = Array.from({ length: 52 }, (_, i) =>
  25 + ((Math.cos(i * 0.3) + 1) * 25)
);

export default function EditorPanel({
  runwayTaskIds,
  heygenVideoId,
  hasVoice,
  hasMusic,
  onClose,
  onDone,
}: EditorPanelProps) {
  const [renderState,    setRenderState]    = useState<RenderState>("idle");
  const [progress,       setProgress]       = useState(0);
  const [finalUrl,       setFinalUrl]       = useState<string | null>(null);
  const [statusMsg,      setStatusMsg]      = useState("");
  const [playheadPct,    setPlayheadPct]    = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate playhead when idle
  useEffect(() => {
    animRef.current = setInterval(() => {
      setPlayheadPct((p) => (p >= 100 ? 0 : p + 0.4));
    }, 50);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

  const clipCount  = Math.max(runwayTaskIds.length, 9); // show 9 demo slots minimum
  const totalSecs  = clipCount * 5;

  async function handleRender() {
    setRenderState("polling");
    setProgress(5);
    setStatusMsg("Polling Runway for clip URLs…");

    try {
      const res  = await fetch("/api/editor", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ runwayTaskIds, heygenVideoId }),
      });
      const data = await res.json();

      if (!data.renderId) {
        setRenderState("failed");
        setStatusMsg("No render ID returned. Check your API keys.");
        return;
      }

      setRenderState("rendering");
      setProgress(20);
      setStatusMsg(
        data.source === "shotstack"
          ? `Shotstack assembling ${data.clipCount} clip(s)…`
          : "Using HeyGen avatar video (Shotstack not configured)…"
      );

      // If HeyGen fallback, mark done immediately
      if (data.source === "heygen") {
        setProgress(100);
        setFinalUrl(data.renderId);
        setRenderState("done");
        onDone(data.renderId);
        return;
      }

      // Poll Shotstack status
      await pollStatus(data.renderId);
    } catch {
      setRenderState("failed");
      setStatusMsg("Render failed — check console for details.");
    }
  }

  async function pollStatus(id: string) {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res  = await fetch(`/api/editor/status/${id}`);
        const data = await res.json();

        setProgress(Math.min(90, 20 + i * 1.2));

        if (data.status === "done") {
          setProgress(100);
          setFinalUrl(data.url ?? id);
          setRenderState("done");
          onDone(data.url ?? id);
          return;
        }
        if (data.status === "failed") {
          setRenderState("failed");
          setStatusMsg("Shotstack render failed.");
          return;
        }
        setStatusMsg(`Shotstack rendering… ${data.progress ?? ""}%`);
      } catch { /* continue */ }
    }
    setRenderState("failed");
    setStatusMsg("Render timed out.");
  }

  const isRunning = renderState === "polling" || renderState === "rendering";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-[#141414] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
           style={{ maxHeight: "85vh" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
              <Film className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">ChitraOps Editor</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.07] text-white/40 font-semibold uppercase tracking-wide">
              {renderState === "idle" ? "Ready" : renderState === "done" ? "Complete" : "Working…"}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-white/[0.05] shrink-0">
          <button className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white transition">
            <Play  className="w-3.5 h-3.5" /> Preview
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white transition">
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
          <div className="flex-1" />
          <span className="text-[11px] text-white/30 font-mono">
            00:00 / {String(Math.floor(totalSecs / 60)).padStart(2,"0")}:{String(totalSecs % 60).padStart(2,"0")}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-white/30">
            <span>{clipCount} clips</span>
            {hasVoice && <span className="text-green-400/70">· Voice ✓</span>}
            {hasMusic && <span className="text-yellow-400/70">· Music ✓</span>}
          </div>
        </div>

        {/* ── Timeline ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">

          {/* Time ruler */}
          <div className="relative h-5 ml-[72px] bg-white/[0.03] rounded border border-white/[0.05] overflow-hidden">
            {Array.from({ length: Math.min(clipCount + 1, 12) }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-white/[0.08] flex items-end pb-0.5"
                style={{ left: `${(i / Math.min(clipCount, 11)) * 100}%` }}
              >
                <span className="text-[8px] text-white/20 pl-1">{i * 5}s</span>
              </div>
            ))}
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500/80"
              style={{ left: `${playheadPct}%`, transition: "left 50ms linear" }}
            />
          </div>

          {/* Video track */}
          <div className="flex items-center gap-4">
            <div className="w-16 shrink-0 flex items-center gap-1.5">
              <Video className="w-3 h-3 text-red-400 shrink-0" />
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Video</span>
            </div>
            <div className="flex-1 h-11 bg-white/[0.03] rounded-xl border border-white/[0.06] flex overflow-hidden">
              {Array.from({ length: clipCount }).map((_, i) => {
                const hasRealTask = i < runwayTaskIds.length;
                return (
                  <div
                    key={i}
                    className={[
                      "h-full flex items-center justify-center border-r border-black/20 text-[9px] font-bold transition-all",
                      hasRealTask
                        ? isRunning
                          ? "bg-red-700/60 animate-pulse"
                          : renderState === "done"
                          ? "bg-red-600/80"
                          : "bg-red-800/50"
                        : "bg-white/[0.04]",
                    ].join(" ")}
                    style={{ width: `${100 / clipCount}%` }}
                  >
                    <span className={hasRealTask ? "text-white/70" : "text-white/15"}>
                      S{i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Voice track */}
          <div className="flex items-center gap-4">
            <div className="w-16 shrink-0 flex items-center gap-1.5">
              <Mic className="w-3 h-3 text-green-400 shrink-0" />
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Voice</span>
            </div>
            <div className="flex-1 h-11 bg-white/[0.03] rounded-xl border border-white/[0.06] overflow-hidden">
              {hasVoice ? (
                <div className="h-full flex items-center gap-px px-2">
                  {WAVE_HEIGHTS_VOICE.map((h, i) => (
                    <div
                      key={i}
                      className="bg-green-400/55 rounded-full shrink-0"
                      style={{ width: 3, height: `${h}%` }}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center px-3">
                  <span className="text-[10px] text-white/15">No voice track — run Voice Synthesis first</span>
                </div>
              )}
            </div>
          </div>

          {/* Music track */}
          <div className="flex items-center gap-4">
            <div className="w-16 shrink-0 flex items-center gap-1.5">
              <Music className="w-3 h-3 text-yellow-400 shrink-0" />
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Music</span>
            </div>
            <div className="flex-1 h-11 bg-white/[0.03] rounded-xl border border-white/[0.06] overflow-hidden">
              {hasMusic ? (
                <div className="h-full flex items-center gap-px px-2">
                  {WAVE_HEIGHTS_MUSIC.map((h, i) => (
                    <div
                      key={i}
                      className="bg-yellow-400/45 rounded-full shrink-0"
                      style={{ width: 3, height: `${h}%` }}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center px-3">
                  <span className="text-[10px] text-white/15">No music track — run Music Generation first</span>
                </div>
              )}
            </div>
          </div>

          {/* Transitions indicator row */}
          <div className="flex items-center gap-4">
            <div className="w-16 shrink-0" />
            <div className="flex-1 h-5 flex items-center gap-px">
              {Array.from({ length: clipCount - 1 }).map((_, i) => (
                <div key={i} className="flex-1 flex justify-end pr-0.5">
                  <div className="w-3 h-3 rounded-full bg-white/[0.08] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  </div>
                </div>
              ))}
              <div className="flex-1" />
            </div>
          </div>
          <p className="text-[9px] text-white/20 ml-20">Fade transitions between all clips</p>
        </div>

        {/* ── Render footer ── */}
        <div className="px-6 pb-6 pt-4 border-t border-white/[0.07] shrink-0">
          {renderState === "done" && finalUrl ? (
            <div className="flex items-center gap-4 bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-4">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Final video ready</p>
                <p className="text-xs text-green-400/80 truncate">{finalUrl}</p>
              </div>
              <a
                href={finalUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl transition shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          ) : renderState === "failed" ? (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{statusMsg}</p>
              <button
                onClick={() => { setRenderState("idle"); setProgress(0); }}
                className="ml-auto text-xs font-bold text-white/60 hover:text-white transition shrink-0"
              >
                Retry
              </button>
            </div>
          ) : isRunning ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                  <span className="text-sm text-white/70">{statusMsg}</span>
                </div>
                <span className="text-xs font-mono text-white/30">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleRender}
              className="w-full flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-2xl transition-all text-sm"
            >
              <Film className="w-4 h-4" />
              Render Final Video
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
