import { NextResponse } from "next/server";

// Poll a Runway task until SUCCEEDED or FAILED (max ~2 min)
async function pollRunwayClip(taskId: string): Promise<string | null> {
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          Authorization:      `Bearer ${process.env.RUNWAY_API_KEY}`,
          "X-Runway-Version": "2024-11-06",
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status === "SUCCEEDED") return data.output?.[0] ?? null;
      if (data.status === "FAILED")    return null;
    } catch { /* keep polling */ }
  }
  return null;
}

// Submit assembled timeline to Shotstack — returns a render ID
async function shotstackRender(clipUrls: string[]): Promise<string | null> {
  const key = process.env.SHOTSTACK_API_KEY;
  if (!key || clipUrls.length === 0) return null;

  let offset = 0;
  const clips = clipUrls.map((src) => {
    const c = {
      asset:      { type: "video", src },
      start:      offset,
      length:     5,
      transition: { in: "fade", out: "fade" },
    };
    offset += 5;
    return c;
  });

  try {
    const res = await fetch("https://api.shotstack.io/edit/stage/render", {
      method:  "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeline: { tracks: [{ clips }] },
        output:   { format: "mp4", resolution: "hd" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.response?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { runwayTaskIds = [], heygenVideoId } = await req.json();

  // Poll all Runway clips in parallel
  const clipUrls = (
    await Promise.all((runwayTaskIds as string[]).map(pollRunwayClip))
  ).filter((u): u is string => !!u);

  if (clipUrls.length > 0) {
    const renderId = await shotstackRender(clipUrls);
    if (renderId) {
      return NextResponse.json({
        renderId,
        source:    "shotstack",
        clipCount: clipUrls.length,
      });
    }
  }

  // Fallback: return the HeyGen video ID directly
  return NextResponse.json({
    renderId:  heygenVideoId ?? null,
    source:    "heygen",
    clipCount: 0,
    note:      "Shotstack key not set or Runway clips not ready — using HeyGen avatar video.",
  });
}
