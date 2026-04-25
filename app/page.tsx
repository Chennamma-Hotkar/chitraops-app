"use client";
import { useState, useRef, useEffect } from "react";
import {
  Paperclip, Mic, MicOff, RefreshCw, Settings, ChevronDown,
  LayoutGrid, Palette, Shield, Users, FileText, Cpu,
  ImageIcon, Video, Download, CheckCircle2, Circle,
  X, Send, Loader2, Play, Scissors, Wand2,
} from "lucide-react";
import EditorPanel from "@/components/EditorPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThinkingItem { id: string; text: string; open: boolean }

interface AttachedFile { name: string; preview: string; mime: string }

interface Message {
  role:          "user" | "director";
  text:          string;
  thinkingItems?: ThinkingItem[];
  attachments?:  AttachedFile[];
  avatarImages?: Record<"front" | "right" | "left", string | null>;
}

interface StepDetail {
  stepId: number;
  fields: { label: string; value: string; tags?: string[] }[];
}

// ─── Static config ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, name: "Project Overview",      icon: LayoutGrid, optional: false },
  { id: 2, name: "Art Style & Aesthetic", icon: Palette,    optional: false },
  { id: 3, name: "Brand Guidelines",      icon: Shield,     optional: true  },
  { id: 4, name: "Characters",            icon: Users,      optional: false },
  { id: 5, name: "Script & Scenes",       icon: FileText,   optional: false },
  { id: 6, name: "Preprocessing Assets",  icon: Cpu,        optional: false },
  { id: 7, name: "Scene Thumbnails",      icon: ImageIcon,  optional: false },
  { id: 8, name: "Video Generation",      icon: Video,      optional: false },
  { id: 9, name: "Final Video",           icon: Download,   optional: false },
];

const TOOL_THINKING: Record<string, string[]> = {
  generate_script:           ["Analysing your prompt",       "Building script structure",    "Saving script"],
  generate_scene_images:     ["Processing scene descriptions","Generating visual prompts",    "Saving storyboard"],
  create_avatar:             ["Configuring avatar style",     "Saving character profile",     "Updating preview"],
  synthesize_voice:          ["Preparing narration text",     "Synthesising voice",           "Saving audio track"],
  generate_background_music: ["Composing music prompt",       "Generating track",             "Saving music"],
  generate_video_clips:      ["Rendering scene prompts",      "Submitting to Runway",         "Saving task IDs"],
  edit_final_video:          ["Assembling clips",             "Syncing audio",                "Rendering final video"],
  search_context:            ["Formulating search query",     "Fetching results",             "Saving context"],
  extract_pdf_context:       ["Reading document",             "Extracting key content",       "Saving context"],
  default:                   ["Analysing input",              "Updating workflow",            "Saving changes"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudioPage() {
  const [step,           setStep]           = useState(2);
  const [userInput,      setUserInput]      = useState("");
  const [isTyping,       setIsTyping]       = useState(false);
  const [pendingFiles,   setPendingFiles]   = useState<AttachedFile[]>([]);
  const [savedAvatarId,  setSavedAvatarId]  = useState<string | null>(null);
  const [sceneReference, setSceneReference] = useState<string | null>(null);
  // Accumulated production assets
  const [runwayTaskIds,  setRunwayTaskIds]  = useState<string[]>([]);
  const [heygenVideoId,  setHeygenVideoId]  = useState<string | null>(null);
  const [hasVoice,       setHasVoice]       = useState(false);
  const [hasMusic,       setHasMusic]       = useState(false);
  const [savedScript,      setSavedScript]      = useState<string | null>(null);
  const [showEditor,       setShowEditor]       = useState(false);
  const [showSettings,     setShowSettings]     = useState(false);
  const [showScriptModal,  setShowScriptModal]  = useState(false);
  const [scriptInput,      setScriptInput]      = useState("");
  const [scriptStyle,      setScriptStyle]      = useState("cinematic");
  const [scriptRunning,    setScriptRunning]    = useState(false);
  const [scriptSteps,      setScriptSteps]      = useState<string[]>([]);
  const [scriptResult,     setScriptResult]     = useState<{audioUrl?:string|null; heygenVideoId?:string|null; runwayTaskIds?:string[]} | null>(null);
  const [isListening,    setIsListening]    = useState(false);
  const [activeDetail,  setActiveDetail]  = useState<StepDetail | null>({
    stepId: 2,
    fields: [
      { label: "STYLE",       value: "CORPORATE 3D ANIMATION", tags: ["Cartoonish"] },
      { label: "DESCRIPTION", value: "Clean, friendly 3D animation style suitable for corporate training. Smooth lighting, soft shadows, professional but approachable characters. Bright and clear visuals, similar to modern tech explainer videos. Stylised 3D rather than hyper-realistic." },
    ],
  });
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "director",
      text: "Hello! I'm your **Chitra Director**. Let's start **Step 1: Project Overview**.\nWhat is the topic of your training video?",
    },
  ]);

  const scrollRef      = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [userInput]);

  function toggleThinking(msgIdx: number, itemId: string) {
    setMessages((prev) =>
      prev.map((m, i) =>
        i !== msgIdx ? m : {
          ...m,
          thinkingItems: m.thinkingItems?.map((t) =>
            t.id === itemId ? { ...t, open: !t.open } : t
          ),
        }
      )
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setPendingFiles((prev) => [...prev, { name: f.name, preview: ev.target?.result as string, mime: f.type }]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }

  function handleMicClick() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Speech recognition is not supported. Please use Chrome or Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    const baseText = userInput;
    recognition.onstart = () => setIsListening(true);
    recognition.onend   = () => setIsListening(false);
    recognition.onerror = (e: any) => { console.error("Mic error:", e.error); setIsListening(false); };
    recognition.onresult = (e: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      const spoken = final || interim;
      setUserInput(baseText ? `${baseText} ${spoken}` : spoken);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  async function handleSend() {
    if ((!userInput.trim() && pendingFiles.length === 0) || isTyping) return;
    const text  = userInput.trim();
    const files = [...pendingFiles];
    setUserInput("");
    setPendingFiles([]);
    const next: Message[] = [...messages, { role: "user", text, attachments: files }];
    setMessages(next);
    setIsTyping(true);

    try {
      // Extract PDF or image attachments as base64
      const pdfFile   = files.find((f) => f.mime === "application/pdf");
      const imageFile = files.find((f) => f.mime.startsWith("image/"));
      const pdfBase64 = pdfFile
        ? pdfFile.preview.replace(/^data:application\/pdf;base64,/, "")
        : undefined;
      const imageBase64 = imageFile
        ? imageFile.preview.replace(/^data:[^;]+;base64,/, "")
        : undefined;

      // Step 4 = Avatar → use as avatar reference; Step 3 = Scenes → save as scene reference
      const avatarImageBase64  = step === 4 ? imageBase64 : undefined;
      const newSceneRef        = step === 3 && imageBase64 ? imageBase64 : undefined;
      if (newSceneRef) setSceneReference(newSceneRef);

      const res  = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          message:    text || (pdfFile ? `I've attached a PDF: ${pdfFile.name}` : imageFile ? `I've attached a photo: ${imageFile.name}` : "I've attached some files."),
          currentStep: step,
          avatarId:           savedAvatarId ?? undefined,
          pdfBase64,
          avatarImageBase64,
          sceneReferenceBase64: newSceneRef ?? sceneReference ?? undefined,
          savedScript:          savedScript ?? undefined,
        }),
      });
      const data = await res.json();

      // Persist production assets for the editor
      if (data.avatarId)     setSavedAvatarId(data.avatarId);
      if (data.scriptContent) setSavedScript(data.scriptContent);
      if (data.videoTaskId) setRunwayTaskIds((prev) => [...prev, data.videoTaskId]);
      if (data.videoUrl)    setHeygenVideoId(data.videoUrl);
      if (data.audioUrl && data.activeTool === "synthesize_voice")          setHasVoice(true);
      if (data.audioUrl && data.activeTool === "generate_background_music") setHasMusic(true);

      const labels = TOOL_THINKING[data.activeTool ?? "default"] ?? TOOL_THINKING.default;
      const thinkingItems: ThinkingItem[] = labels.map((label, i) => ({
        id:   `${Date.now()}-${i}`,
        text: label,
        open: false,
      }));

      // Update right panel detail when a step completes
      if (data.stepReached && data.stepReached > step) {
        const completedStep = STEPS.find((s) => s.id === data.stepReached - 1);
        if (completedStep) {
          setActiveDetail({
            stepId: completedStep.id,
            fields: [{ label: "STATUS", value: "Complete — ready for next step." }],
          });
        }
      }

      setTimeout(() => {
        setMessages([...next, {
          role: "director",
          text: data.reply,
          thinkingItems,
          avatarImages: data.avatarImages ?? undefined,
        }]);
        if (data.stepReached) setStep(data.stepReached);
        setIsTyping(false);
      }, 800);
    } catch (err: any) {
      const detail = err?.message ?? String(err);
      setMessages([...next, {
        role: "director",
        text: `Connection error — ${detail.includes("quota") || detail.includes("429") ? "Gemini API quota exceeded. Please check your API key at aistudio.google.com." : "check your API keys in .env.local."}\n\nDetails: ${detail.slice(0, 200)}`,
        thinkingItems: [],
      }]);
      setIsTyping(false);
    }
  }

  async function handleScriptToVideo() {
    if (!scriptInput.trim() || scriptRunning) return;
    setScriptRunning(true);
    setScriptSteps([]);
    setScriptResult(null);
    try {
      const res  = await fetch("/api/script-to-video", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ script: scriptInput, avatarId: savedAvatarId, style: scriptStyle }),
      });
      const data = await res.json();
      setScriptSteps(data.steps ?? []);
      setScriptResult({ audioUrl: data.audioUrl, heygenVideoId: data.heygenVideoId, runwayTaskIds: data.runwayTaskIds });
      if (data.runwayTaskIds?.length) setRunwayTaskIds(data.runwayTaskIds);
      if (data.heygenVideoId)         setHeygenVideoId(data.heygenVideoId);
      if (data.audioUrl)              setHasVoice(true);
    } catch (e: any) {
      setScriptSteps([`Error: ${e.message}`]);
    } finally {
      setScriptRunning(false);
    }
  }

  function handleNewProject() {
    if (!confirm("Start a new project? Your current session will be cleared.")) return;
    setStep(1);
    setUserInput("");
    setIsTyping(false);
    setPendingFiles([]);
    setSavedAvatarId(null);
    setSceneReference(null);
    setRunwayTaskIds([]);
    setHeygenVideoId(null);
    setHasVoice(false);
    setHasMusic(false);
    setShowEditor(false);
    setActiveDetail(null);
    setMessages([{
      role: "director",
      text: "Hello! I'm your **Chitra Director**. Let's start **Step 1: Project Overview**.\nWhat is the topic of your training video?",
    }]);
  }

  const AGENTS = [
    { name: "Director Agent",      tool: "Gemini Flash",       key: true,  step: "All steps"  },
    { name: "PDF Reader",          tool: "Gemini inline data", key: true,  step: "Step 1"     },
    { name: "Search Agent",        tool: "DuckDuckGo",         key: true,  step: "Step 1"     },
    { name: "Script Generator",    tool: "Gemini Flash",       key: true,  step: "Step 2"     },
    { name: "Image Generator",     tool: "Stability AI",       key: true,  step: "Step 3"     },
    { name: "Avatar Creator",      tool: "HeyGen",             key: true,  step: "Step 4"     },
    { name: "Voice Synthesizer",   tool: "ElevenLabs",         key: true,  step: "Step 5"     },
    { name: "Music Generator",     tool: "HuggingFace MusicGen",key: true, step: "Step 6"     },
    { name: "Video Generator",     tool: "Runway ML Gen-3",    key: true,  step: "Step 7"     },
    { name: "Video Editor",        tool: "HeyGen",             key: true,  step: "Step 8"     },
    { name: "VAPI Voice Interface",tool: "Vapi",               key: true,  step: "All steps"  },
  ];

  const doneSteps = Math.max(0, step - 1);

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 overflow-hidden">

      {/* ─── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 shrink-0 bg-white z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shrink-0">
            <Play className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          <span className="text-red-600 font-black text-lg tracking-tight uppercase">ChitraOps</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowScriptModal(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-xl transition"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Script → Video
          </button>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition"
          >
            <RefreshCw className="w-4 h-4" />
            New Project
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* ─── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── Chat ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-8 space-y-7">
            {messages.map((msg, mi) => (
              <div key={mi} className={`flex gap-3.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

                {/* Director avatar */}
                {msg.role === "director" && (
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Play className="w-3.5 h-3.5 text-white fill-white" />
                  </div>
                )}

                <div className={`${msg.role === "user" ? "max-w-xl" : "flex-1 max-w-2xl"}`}>

                  {/* Role label */}
                  <p className={`text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2 ${msg.role === "user" ? "text-right" : ""}`}>
                    {msg.role === "director" ? "Chitra Director" : "You"}
                  </p>

                  {/* User attachments */}
                  {msg.role === "user" && msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end mb-2">
                      {msg.attachments.map((f, fi) => (
                        <div key={fi} className="flex items-center gap-2 bg-gray-100 rounded-xl px-2.5 py-1.5">
                          {f.mime.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.preview} alt={f.name} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                          <span className="text-xs text-gray-600 font-medium max-w-[90px] truncate">{f.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Thinking process (director only) */}
                  {msg.role === "director" && msg.thinkingItems && msg.thinkingItems.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-3 cursor-default select-none">
                        <div className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-[9px] text-gray-400 font-bold">i</div>
                        <span>View thinking process</span>
                        <ChevronDown className="w-3 h-3" />
                      </div>
                      <div className="space-y-2">
                        {msg.thinkingItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => toggleThinking(mi, item.id)}
                            className="w-full flex items-center justify-between gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl px-4 py-3 text-left transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              </div>
                              <span className="text-sm text-gray-700 font-medium">{item.text}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ${item.open ? "rotate-180" : ""}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message text */}
                  {msg.role === "director" ? (
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      <RichText text={msg.text} />
                    </p>
                  ) : (
                    <p className="text-sm text-gray-700 leading-relaxed text-right">
                      <RichText text={msg.text} />
                    </p>
                  )}

                  {/* Avatar angle images (director only) */}
                  {msg.role === "director" && msg.avatarImages && (
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {(["front", "right", "left"] as const).map((angle) =>
                        msg.avatarImages![angle] ? (
                          <div key={angle} className="flex flex-col items-center gap-1.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.avatarImages![angle]!}
                              alt={`${angle} face`}
                              className="w-full aspect-square object-cover rounded-2xl border border-gray-100 shadow-sm"
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              {angle === "front" ? "Front" : angle === "right" ? "Right" : "Left"}
                            </span>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </div>

                {/* User avatar */}
                {msg.role === "user" && (
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3.5">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 text-white fill-white" />
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm pt-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Director is thinking…</span>
                </div>
              </div>
            )}
          </div>

          {/* ─── Input ──────────────────────────────────────────────────────── */}
          <div className="px-10 pb-8 shrink-0">
            <div className="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">

              {/* File chips */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="relative flex items-center gap-2 bg-gray-100 rounded-xl px-2.5 py-2 pr-8">
                      {f.mime.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.preview} alt={f.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <span className="text-xs text-gray-600 font-medium max-w-[80px] truncate">{f.name}</span>
                      <button
                        onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-300 hover:bg-gray-400 flex items-center justify-center transition"
                      >
                        <X className="w-2.5 h-2.5 text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Text row */}
              <div className="flex items-end gap-3 px-4 py-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-gray-400 hover:text-gray-600 transition shrink-0 pb-0.5"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                />
                <textarea
                  ref={textareaRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Describe your video idea or ask a question…"
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none leading-relaxed"
                />
                <button
                  onClick={handleMicClick}
                  title={isListening ? "Stop recording" : "Start voice input"}
                  className={`transition shrink-0 pb-0.5 ${isListening ? "text-red-500 animate-pulse" : "text-gray-400 hover:text-gray-600"}`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleSend}
                  disabled={isTyping || (!userInput.trim() && pendingFiles.length === 0)}
                  className="w-8 h-8 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 rounded-full flex items-center justify-center transition shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right Panel ──────────────────────────────────────────────────── */}
        <div className="w-[360px] shrink-0 border-l border-gray-100 bg-white flex flex-col overflow-hidden">

          {/* Progress header */}
          <div className="px-5 pt-5 pb-4 shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-base font-bold text-gray-900">Progress</h2>
              <span className="text-sm text-gray-400">{doneSteps}/9</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 rounded-full transition-all duration-700"
                style={{ width: `${(doneSteps / 9) * 100}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="flex-1 overflow-y-auto">
            {STEPS.map((s) => {
              const Icon      = s.icon;
              const isDone    = step > s.id;
              const isCurrent = step === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (isDone || isCurrent) {
                      setActiveDetail((prev) =>
                        prev?.stepId === s.id ? null : {
                          stepId: s.id,
                          fields: [{ label: "STATUS", value: isDone ? "Complete" : "In progress" }],
                        }
                      );
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left ${
                    (isDone || isCurrent) ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    isDone    ? "bg-green-50"
                    : isCurrent ? "bg-gray-100"
                    :             "bg-gray-50"
                  }`}>
                    <Icon className={`w-3.5 h-3.5 ${
                      isDone    ? "text-green-500"
                      : isCurrent ? "text-gray-500"
                      :             "text-gray-300"
                    }`} />
                  </div>
                  <span className={`text-sm flex-1 ${
                    isDone    ? "text-gray-700 font-medium"
                    : isCurrent ? "text-gray-900 font-semibold"
                    :             "text-gray-400 font-normal"
                  }`}>
                    {s.name}
                    {s.optional && <span className="text-gray-400 font-normal"> (opt)</span>}
                  </span>
                  {isDone    && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
                  {isCurrent && <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin shrink-0" />}
                  {!isDone && !isCurrent && <Circle className="w-4 h-4 text-gray-200 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Open Editor button — visible from step 8 onward */}
          {step >= 8 && (
            <div className="px-4 mb-3 shrink-0">
              <button
                onClick={() => setShowEditor(true)}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white text-sm font-bold py-3 rounded-2xl transition-all"
              >
                <Scissors className="w-4 h-4 text-red-400" />
                Open Editor Agent
              </button>
            </div>
          )}

          {/* Detail card */}
          {activeDetail && (
            <div className="mx-4 mb-4 border border-gray-200 rounded-2xl overflow-hidden shrink-0 shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center shrink-0">
                    <Play className="w-2.5 h-2.5 text-white fill-white" />
                  </div>
                  <span className="text-sm font-bold text-gray-800">
                    {STEPS.find((s) => s.id === activeDetail.stepId)?.name}
                  </span>
                </div>
                <button onClick={() => setActiveDetail(null)} className="text-gray-400 hover:text-gray-600 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-4 space-y-4">
                {activeDetail.fields.map((field, fi) => (
                  <div key={fi}>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-1.5">
                      {field.label}
                      {/* Inline value for short labels */}
                      {!field.tags?.length && field.value.length < 30 && (
                        <span className="text-gray-600 normal-case tracking-normal font-semibold ml-2 text-xs">{field.value}</span>
                      )}
                    </p>
                    {field.tags && field.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {field.tags.map((tag, ti) => (
                          <span key={ti} className="px-2.5 py-0.5 bg-red-50 text-red-500 rounded-full text-[11px] font-semibold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {(field.tags?.length || field.value.length >= 30) && (
                      <p className="text-xs text-gray-500 leading-relaxed">{field.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Script → Video modal ── */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
                  <Wand2 className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Script → Video</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold uppercase tracking-wide">Auto Pipeline</span>
              </div>
              <button onClick={() => { setShowScriptModal(false); setScriptSteps([]); setScriptResult(null); }} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Style selector */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">Style</label>
                <div className="flex gap-2 flex-wrap">
                  {["cinematic", "3D animation", "corporate", "documentary", "cartoon"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScriptStyle(s)}
                      className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${scriptStyle === s ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Script input */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Your Script</label>
                <textarea
                  value={scriptInput}
                  onChange={(e) => setScriptInput(e.target.value)}
                  placeholder={"Scene 1:\nThe presenter walks into frame...\n\nScene 2:\nClose-up on the product demo..."}
                  rows={10}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-red-400 resize-none leading-relaxed"
                />
                <p className="text-xs text-gray-400 mt-1">Separate scenes with a blank line. Each paragraph becomes one video clip.</p>
              </div>

              {/* Steps log */}
              {scriptSteps.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                  {scriptSteps.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Result */}
              {scriptResult && (
                <div className="space-y-3">
                  {scriptResult.audioUrl && (
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-green-700">Voice narration ready</p>
                        <audio controls src={scriptResult.audioUrl} className="mt-1.5 w-full h-8" />
                      </div>
                    </div>
                  )}
                  {scriptResult.heygenVideoId && (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <Video className="w-4 h-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-blue-700">Avatar video queued</p>
                        <p className="text-[11px] text-blue-500 font-mono mt-0.5">ID: {scriptResult.heygenVideoId}</p>
                      </div>
                    </div>
                  )}
                  {scriptResult.runwayTaskIds && scriptResult.runwayTaskIds.length > 0 && (
                    <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                      <Scissors className="w-4 h-4 text-purple-500 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-purple-700">{scriptResult.runwayTaskIds.length} Runway clip(s) rendering</p>
                        <p className="text-[11px] text-purple-500 mt-0.5">Open Editor Agent to assemble final video</p>
                      </div>
                    </div>
                  )}
                  {scriptResult.runwayTaskIds && scriptResult.runwayTaskIds.length > 0 && (
                    <button
                      onClick={() => { setShowScriptModal(false); setShowEditor(true); }}
                      className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white text-sm font-bold py-3 rounded-2xl transition"
                    >
                      <Scissors className="w-4 h-4 text-red-400" />
                      Open Editor Agent
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!scriptResult && (
              <div className="px-6 pb-6 pt-3 shrink-0">
                <button
                  onClick={handleScriptToVideo}
                  disabled={scriptRunning || !scriptInput.trim()}
                  className="w-full flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-2xl transition text-sm"
                >
                  {scriptRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {scriptRunning ? "Generating…" : "Generate Video"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Agent Status</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {AGENTS.map((a) => (
                <div key={a.name} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.tool} · {a.step}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                  </span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">All pipeline agents are configured and ready. API keys are set in <code className="text-gray-600">.env.local</code>.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor Panel modal ── */}
      {showEditor && (
        <EditorPanel
          runwayTaskIds={runwayTaskIds}
          heygenVideoId={heygenVideoId}
          hasVoice={hasVoice}
          hasMusic={hasMusic}
          onClose={() => setShowEditor(false)}
          onDone={(url) => {
            setShowEditor(false);
            setStep(9);
            setMessages((prev) => [
              ...prev,
              {
                role: "director",
                text: `**Final video is ready!** The Editor Agent has assembled all clips, voice narration, and background music.\n\nVideo URL: ${url}`,
                thinkingItems: [
                  { id: "e1", text: "Assembling video clips", open: false },
                  { id: "e2", text: "Syncing voice narration", open: false },
                  { id: "e3", text: "Mixing background music", open: false },
                ],
              },
            ]);
          }}
        />
      )}
    </div>
  );
}
