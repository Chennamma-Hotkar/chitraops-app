"use client";
import { Play, Square, Shield, Radio } from 'lucide-react';
import { useState, useEffect } from 'react';
import Vapi from "@vapi-ai/web";

// Your Assistant ID is preserved here
const assistantId = "58486cd1-3445-4bdf-bfd4-7bf4e30b7776"; 

export default function Hero() {
  const [vapi, setVapi] = useState<any>(null);
  const [isCalling, setIsCalling] = useState(false);

  useEffect(() => {
    // Initialize Vapi on the client side
    const vapiInstance = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
    setVapi(vapiInstance);

    vapiInstance.on("call-start", () => setIsCalling(true));
    vapiInstance.on("call-end", () => setIsCalling(false));

    return () => { vapiInstance.stop(); };
  }, []);

  const handleToggleCall = () => {
    if (isCalling) {
      vapi.stop();
    } else {
      vapi.start(assistantId);
    }
  };

  return (
    <div className="relative min-h-[90vh] w-full flex items-center px-6 md:px-16 overflow-hidden bg-[#141414]">
      
      {/* BACKGROUND SCENE: Cinematic Grid and Image */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070')] bg-cover bg-center opacity-30" />
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="z-20 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* LEFT SIDE: Mission Briefing */}
        <div className="flex flex-col space-y-6">
          <div className="flex items-center space-x-2 text-red-600 font-bold tracking-[0.3em] uppercase text-sm">
            <Shield className="w-4 h-4" />
            <span>ChitraOps Original Simulation</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-[0.85] text-white">
            CYBER <br/> <span className="text-zinc-400">DEFENSE</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-lg leading-relaxed font-medium">
            {isCalling 
              ? "Communication line secured. Focus on Aria's instructions. She is evaluating your responses to potential phishing threats."
              : "Step into the boots of a security analyst. Talk to our AI Coach, Aria Bloom, and complete your interactive certification."}
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <button 
              onClick={handleToggleCall}
              className={`group flex items-center px-10 py-4 rounded-md transition-all text-xl font-black uppercase tracking-tighter ${
                isCalling 
                ? "bg-red-600 text-white shadow-[0_0_30px_rgba(229,9,20,0.6)]" 
                : "bg-white text-black hover:bg-red-600 hover:text-white"
              }`}
            >
              {isCalling ? <Square className="w-6 h-6 mr-3 fill-current" /> : <Play className="w-6 h-6 mr-3 fill-current" />}
              {isCalling ? "Abort Mission" : "Initiate Call"}
            </button>
            
            {!isCalling && (
                <button className="px-8 py-4 bg-zinc-800/80 text-white font-bold rounded-md hover:bg-zinc-700 transition backdrop-blur-md border border-zinc-700 uppercase tracking-tighter">
                    Training Info
                </button>
            )}
          </div>

          {/* REAL-TIME STATUS INDICATOR */}
          {isCalling && (
            <div className="flex items-center space-x-3 text-red-500 font-mono text-sm bg-red-500/10 w-fit px-4 py-2 rounded-full border border-red-500/20">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="font-bold tracking-widest">ENCRYPTED VOICE LINK ACTIVE</span>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: THE AI AVATAR FACE */}
        <div className="relative flex justify-center items-center">
          {/* Outer Glowing Ring */}
          <div className={`absolute w-[300px] h-[300px] md:w-[450px] md:h-[450px] rounded-full border-2 transition-all duration-1000 ${
            isCalling ? "border-red-600 scale-110 opacity-100 shadow-[0_0_80px_rgba(229,9,20,0.4)]" : "border-zinc-800 scale-100 opacity-30"
          }`} />

          {/* The Avatar Container */}
          <div className={`relative w-[280px] h-[280px] md:w-[420px] md:h-[420px] rounded-full overflow-hidden border-4 transition-all duration-700 z-10 ${
            isCalling ? "border-red-600 ring-8 ring-red-600/20" : "border-zinc-700 grayscale"
          }`}>
            <video
              autoPlay
              playsInline
              loop
              muted={!isCalling}
              className="w-full h-full object-cover"
              src={isCalling 
                ? "https://resource.heygen.com/interactive-avatar/demo-video.mp4" // Real-time placeholder
                : "https://www.w3schools.com/howto/eyecandy.mp4" // IDLE state video
              }
            />
            
            {/* Scanline Effect Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20" />
          </div>

          {/* Coach Name Tag */}
          <div className={`absolute bottom-0 bg-red-600 text-white font-black px-6 py-2 rounded-sm z-20 transition-transform duration-500 tracking-tighter uppercase ${
            isCalling ? "translate-y-4 scale-110" : "translate-y-10 scale-90 opacity-0"
          }`}>
            Aria Bloom: AI Officer
          </div>
        </div>

      </div>
    </div>
  );
}