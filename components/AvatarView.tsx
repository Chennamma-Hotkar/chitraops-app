"use client";
import { useEffect, useRef } from "react";

export default function AvatarView({ isCalling }: { isCalling: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Note: For a hackathon, we use a high-quality video placeholder 
  // until you link the HeyGen Streaming SDK.
  return (
    <div className={`relative w-[350px] h-[350px] rounded-full overflow-hidden border-4 border-red-600 shadow-[0_0_50px_rgba(229,9,20,0.5)] transition-all duration-500 ${isCalling ? 'scale-110 opacity-100' : 'scale-90 opacity-50'}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
        src={isCalling 
          ? "https://resource.heygen.com/interactive-avatar/demo-video.mp4" // Placeholder HeyGen video
          : "https://www.w3schools.com/howto/eyecandy.mp4" // Idle state
        }
        loop
      />
      {isCalling && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
          LIVE AI COACH
        </div>
      )}
    </div>
  );
}