import { NextResponse } from "next/server";

// Sarah (EXAVITQu4vr4xnSDxMaL) — natural female, available on free tier
const VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

async function synthesizeVoice(script: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key":   process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: script.substring(0, 2500),
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return `data:audio/mpeg;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch { return null; }
}

async function generateHeyGenVideo(script: string, avatarId: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key":    process.env.HEYGEN_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_inputs: [{
          character: { type: "avatar", avatar_id: avatarId },
          voice: {
            type:       "text",
            input_text: script.substring(0, 1500),
            voice_id:   "en-US-AriaNeural",
          },
        }],
        dimension: { width: 1280, height: 720 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.video_id ?? null;
  } catch { return null; }
}

async function submitRunwayClip(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.dev.runwayml.com/v1/tasks", {
      method: "POST",
      headers: {
        Authorization:      `Bearer ${process.env.RUNWAY_API_KEY}`,
        "Content-Type":     "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        taskType:   "textToVideo",
        model:      "gen3a_turbo",
        textPrompt: prompt.substring(0, 512),
        duration:   5,
        ratio:      "1280:768",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ?? null;
  } catch { return null; }
}

export async function POST(req: Request) {
  try {
    const { script, avatarId, style, scenes } = await req.json();
    if (!script?.trim()) {
      return NextResponse.json({ error: "Script is required." }, { status: 400 });
    }

    const selectedAvatar = avatarId || "Daisy-professional-20230630";
    const results: Record<string, any> = { steps: [] };

    // Step 1: Voice synthesis
    results.steps.push("Synthesizing voice narration…");
    const audioUrl = await synthesizeVoice(script);
    results.audioUrl = audioUrl;
    results.steps.push(audioUrl ? "Voice ready." : "Voice synthesis failed (check ElevenLabs key).");

    // Step 2: Avatar video via HeyGen
    results.steps.push("Generating avatar video via HeyGen…");
    const heygenVideoId = await generateHeyGenVideo(script, selectedAvatar);
    results.heygenVideoId = heygenVideoId;
    results.steps.push(heygenVideoId ? `HeyGen video queued (ID: ${heygenVideoId}).` : "HeyGen failed (check key).");

    // Step 3: Runway clips — one per scene or split script into chunks
    const sceneList: string[] = scenes?.length
      ? scenes
      : script.split(/\n{2,}/).filter((s: string) => s.trim().length > 20).slice(0, 5);

    results.steps.push(`Submitting ${sceneList.length} scene(s) to Runway ML…`);
    const runwayTaskIds: string[] = [];
    for (const scene of sceneList) {
      const taskId = await submitRunwayClip(`${style || "cinematic"} scene: ${scene.substring(0, 400)}`);
      if (taskId) runwayTaskIds.push(taskId);
    }
    results.runwayTaskIds = runwayTaskIds;
    results.steps.push(runwayTaskIds.length > 0
      ? `${runwayTaskIds.length} Runway clip(s) queued. Poll /api/editor/status to check progress.`
      : "Runway submission failed (check key)."
    );

    return NextResponse.json({
      success: true,
      audioUrl,
      heygenVideoId,
      runwayTaskIds,
      steps: results.steps,
      message: `Pipeline started. Voice: ${audioUrl ? "ready" : "failed"}, HeyGen: ${heygenVideoId ? "queued" : "failed"}, Runway clips: ${runwayTaskIds.length}.`,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
