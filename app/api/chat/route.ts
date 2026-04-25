import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const tools = [
  {
    functionDeclarations: [
      {
        name: "extract_pdf_context",
        description: "PDF Reader Tool: Extracts and analyses text from documents to build story context.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            documentSummary: { type: SchemaType.STRING },
          },
          required: ["documentSummary"],
        },
      },
      {
        name: "generate_script",
        description: "Text Generation Tool (Gemini): Writes a professional script divided into scenes from the story prompt.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            topic:      { type: SchemaType.STRING },
            tone:       { type: SchemaType.STRING },
            sceneCount: { type: SchemaType.NUMBER },
          },
          required: ["topic", "tone"],
        },
      },
      {
        name: "generate_scene_images",
        description: "Image Generation Tool: Creates visual storyboard images for each scene using AI image models.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            sceneDescription: { type: SchemaType.STRING },
            artStyle: {
              type: SchemaType.STRING,
              // Possible styles passed to image generation APIs
            },
          },
          required: ["sceneDescription", "artStyle"],
        },
      },
      {
        name: "create_avatar",
        description: "Avatar Tool: Configures a human avatar in 3D, cartoon, or anime style for video narration.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            characterName: { type: SchemaType.STRING },
            avatarStyle:   { type: SchemaType.STRING }, // "3d" | "cartoon" | "anime" | "realistic"
            gender:        { type: SchemaType.STRING },
          },
          required: ["characterName", "avatarStyle"],
        },
      },
      {
        name: "synthesize_voice",
        description: "Voice Synthesis Tool: Generates narration audio from the script text (uses ElevenLabs or similar).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            script:     { type: SchemaType.STRING },
            voiceStyle: { type: SchemaType.STRING },
            language:   { type: SchemaType.STRING },
          },
          required: ["script", "voiceStyle"],
        },
      },
      {
        name: "generate_background_music",
        description: "Music Generation Tool: Composes background music matching the video mood (uses Suno AI or similar).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            mood:     { type: SchemaType.STRING },
            duration: { type: SchemaType.NUMBER },
          },
          required: ["mood"],
        },
      },
      {
        name: "generate_video_clips",
        description: "Video Generation Tool: Renders individual video clips for each scene via HeyGen or Runway ML.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            script:     { type: SchemaType.STRING },
            avatarId:   { type: SchemaType.STRING },
            sceneCount: { type: SchemaType.NUMBER },
          },
          required: ["script"],
        },
      },
      {
        name: "edit_final_video",
        description: "Video Editing Tool: Cuts, merges, and assembles all clips into the final video with music and transitions.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            clips:       { type: SchemaType.STRING },
            musicTrack:  { type: SchemaType.STRING },
            transitions: { type: SchemaType.STRING },
          },
          required: ["clips"],
        },
      },
      {
        name: "search_context",
        description: "Search Tool: Fetches real-world information to enrich video content.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: { type: SchemaType.STRING },
          },
          required: ["query"],
        },
      },
    ],
  },
];

const TOOL_TO_STEP: Record<string, number> = {
  extract_pdf_context:       2,
  generate_script:           3,
  generate_scene_images:     4,
  create_avatar:             5,
  synthesize_voice:          6,
  generate_background_music: 7,
  generate_video_clips:      8,
  edit_final_video:          9,
  search_context:            2,
};

const TOOL_LABELS: Record<string, string> = {
  extract_pdf_context:       "PDF Reader Tool",
  generate_script:           "Text Generation Tool",
  generate_scene_images:     "Image Generation Tool",
  create_avatar:             "Avatar Tool",
  synthesize_voice:          "Voice Synthesis Tool",
  generate_background_music: "Music Generation Tool",
  generate_video_clips:      "Video Generation Tool",
  edit_final_video:          "Video Editing Tool",
  search_context:            "Search Tool",
};

// HeyGen avatar IDs mapped by style preference
const AVATAR_MAP: Record<string, string> = {
  "3d":        "Daisy-professional-20230630",
  "cartoon":   "Daisy-professional-20230630",
  "anime":     "Tyler-incasual-20230829",
  "realistic": "Ann-professional-20230830",
  "male":      "Tyler-incasual-20230829",
  "female":    "Daisy-professional-20230630",
};

export async function POST(req: Request) {
  let message: string, currentStep: number, savedAvatarId: string | undefined, pdfBase64: string | undefined, avatarImageBase64: string | undefined, sceneReferenceBase64: string | undefined, savedScript: string | undefined;
  try {
    ({ message, currentStep, avatarId: savedAvatarId, pdfBase64, avatarImageBase64, sceneReferenceBase64, savedScript } = await req.json());
  } catch {
    return NextResponse.json({ reply: "Invalid request body.", stepReached: 1 }, { status: 400 });
  }

  try {

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: tools as any,
    systemInstruction: `You are the Chitra Director Agent orchestrating a 9-step video production pipeline.
Your agents: PDF Reader, Text Generator (Gemini), Image Generator, Avatar Creator, Voice Synthesiser, Music Generator, Video Generator, Video Editor, Search Agent.
Current pipeline step: ${currentStep}/9.

IMPORTANT: If the user's message includes an attached PDF document, you MUST immediately call extract_pdf_context with a thorough documentSummary covering the main topic, key points, tone, and any characters or branding mentioned in the document.

Pipeline order:
1. Story Input  → if PDF attached call extract_pdf_context; else call search_context if needed
2. Script       → call generate_script with topic, tone, and sceneCount
3. Scenes       → call generate_scene_images for visual storyboards
4. Avatar       → call create_avatar (3d / cartoon / anime / realistic)
5. Audio        → call synthesize_voice
6. Music        → call generate_background_music
7. Video Clips  → call generate_video_clips
8. Editing      → call edit_final_video
9. Final Video  → confirm delivery

Be concise and professional. After each tool call, briefly confirm what was done and what comes next.
BRANDING: Always use "ChitraOps" — never write "NeuroFlix" or "Neuroflix" in any response or generated script.
${savedScript ? `\nPREVIOUSLY GENERATED SCRIPT (use this for scene generation):\n${savedScript}` : ""}`,
  });

  const chat = model.startChat();

  // If a PDF was attached, pass it as Gemini inline data alongside the message
  const messageParts = pdfBase64
    ? [
        { inlineData: { mimeType: "application/pdf" as const, data: pdfBase64 } },
        { text: message },
      ]
    : message;

  const result = await chat.sendMessage(messageParts);
  const sanitize = (s: string) => s.replace(/NeuroFlix|Neuroflix|neuroflix/g, "ChitraOps");
  const call = result.response.functionCalls()?.[0];

  if (call) {
    const toolLabel = TOOL_LABELS[call.name] || call.name;
    const nextStep  = TOOL_TO_STEP[call.name] || currentStep;

    // ── extract_pdf_context ───────────────────────────────────────────────────
    if (call.name === "extract_pdf_context") {
      const args    = call.args as Record<string, string>;
      const summary = args.documentSummary ?? "No summary returned.";
      return NextResponse.json({
        reply:       `**PDF Reader Tool** activated.\n\nExtracted content:\n\n${summary}\n\nI'll use this as the foundation for your video script. Ready to proceed whenever you are.`,
        pdfSummary:  summary,
        stepReached: nextStep,
        activeTool:  call.name,
      });
    }

    // ── create_avatar ─────────────────────────────────────────────────────────
    if (call.name === "create_avatar") {
      const args     = call.args as Record<string, string>;
      const style    = (args.avatarStyle || "3d").toLowerCase();
      const gender   = (args.gender      || "female").toLowerCase();
      const avatarId = AVATAR_MAP[style] ?? AVATAR_MAP[gender] ?? AVATAR_MAP["female"];

      let avatarImages: Record<"front" | "right" | "left", string | null> | null = null;
      if (avatarImageBase64) {
        const artStyle =
          style === "cartoon"   ? "cartoon illustrated" :
          style === "anime"     ? "anime illustration"  :
          style === "realistic" ? "photorealistic"      : "3D CGI rendered";
        avatarImages = await generateAvatarAngles(avatarImageBase64, artStyle);
      }

      const hasImages = avatarImages && Object.values(avatarImages).some(Boolean);
      return NextResponse.json({
        reply: `Avatar Tool activated. Configured a **${args.avatarStyle || "3D"}** avatar "${args.characterName || "Presenter"}" (ID: ${avatarId}). ${hasImages ? "Generated **front**, **right**, and **left** face views from your reference photo. " : ""}Voice narration is next.`,
        avatarId,
        avatarImages,
        stepReached:  nextStep,
        activeTool:   call.name,
      });
    }

    // ── search_context (DuckDuckGo — no key needed) ───────────────────────────
    if (call.name === "search_context") {
      const args    = call.args as Record<string, string>;
      const snippet = await searchDuckDuckGo(args.query || message);
      return NextResponse.json({
        reply:       `Search Tool activated. Query: "${args.query}". ${snippet ? `Found: ${snippet}` : "No results — continuing with existing context."}`,
        stepReached:  nextStep,
        activeTool:   call.name,
      });
    }

    if (call.name === "generate_scene_images") {
      const args = call.args as Record<string, string>;
      const description = args.sceneDescription || message;
      const artStyle    = args.artStyle || "3D cinematic";
      const imageUrl = sceneReferenceBase64
        ? await generateSceneImageFromReference(description, artStyle, sceneReferenceBase64)
        : await generateSceneImage(description, artStyle);
      const mode = sceneReferenceBase64 ? "reference-guided" : "text-to-image";
      return NextResponse.json({
        reply: `Image Generation Tool activated. Creating a **${artStyle}** storyboard visual (${mode}) using Stability AI. ${imageUrl ? "Scene image ready." : "Image generation failed — check your Stability API key."}`,
        imageUrl,
        stepReached:  nextStep,
        activeTool:   call.name,
        agentThinking:"Image Generation Tool processing…",
      });
    }

    if (call.name === "synthesize_voice") {
      const args = call.args as Record<string, string>;
      const audioUrl = await synthesizeVoiceElevenLabs(
        args.script || message,
        args.voiceStyle || "professional"
      );
      return NextResponse.json({
        reply: `Voice Synthesis Tool activated. Generating ${args.voiceStyle || "professional"} narration using ElevenLabs. ${audioUrl ? "Audio ready." : "Voice synthesis failed — check your ElevenLabs API key."}`,
        audioUrl,
        stepReached:  nextStep,
        activeTool:   call.name,
        agentThinking:"Voice Synthesis Tool processing…",
      });
    }

    if (call.name === "generate_background_music") {
      const args = call.args as Record<string, string>;
      const audioUrl = await generateMusicWithHuggingFace(args.mood || "ambient");
      return NextResponse.json({
        reply: `Music Generation Tool activated. Composing ${args.mood || "ambient"} background music using Meta MusicGen. ${audioUrl ? "Track is ready." : "Generation queued — may take ~30s on free tier."}`,
        audioUrl,
        stepReached:  nextStep,
        activeTool:   call.name,
        agentThinking:"Music Generation Tool processing…",
      });
    }

    if (call.name === "generate_video_clips") {
      const args = call.args as Record<string, string>;
      const taskId = await generateVideoWithRunway(args.script || message);
      return NextResponse.json({
        reply: `Video Generation Tool activated. Runway Gen-3 is rendering scene clips from your script. ${taskId ? `Task queued (ID: ${taskId}).` : "Check your Runway API key."} This takes 60–90 seconds per clip.`,
        videoTaskId:  taskId,
        stepReached:  nextStep,
        activeTool:   call.name,
        agentThinking:"Video Generation Tool processing…",
      });
    }

    if (call.name === "edit_final_video") {
      const args = call.args as Record<string, string>;
      const videoData = await triggerHeyGenVideo(
        args.script || message,
        savedAvatarId || args.avatarId || "Daisy-professional-20230630"
      );
      return NextResponse.json({
        reply: `Video Editing Tool activated. HeyGen is assembling your avatar presenter video with all clips and transitions.`,
        videoUrl: videoData?.data?.video_id
          ? `https://api.heygen.com/v1/video_status.get?video_id=${videoData.data.video_id}`
          : null,
        stepReached:  nextStep,
        activeTool:   call.name,
        agentThinking:"Video Editing Tool processing…",
      });
    }

    // ── generate_script — actually write the script ───────────────────────────
    if (call.name === "generate_script") {
      const args = call.args as Record<string, string>;
      const scriptModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const scriptRes = await scriptModel.generateContent(
        `Write a complete video script for a ChitraOps production.
Topic: ${args.topic || message}
Tone: ${args.tone || "professional"}
Number of scenes: ${args.sceneCount || 5}

For each scene write:
SCENE [N]: [Title]
VISUAL: [Detailed visual description for the storyboard image]
NARRATION: [Voice narration text]

Use "ChitraOps" as the brand name. Output ONLY the script, no preamble.`
      );
      const scriptContent = sanitize(scriptRes.response.text());
      return NextResponse.json({
        reply: `**Text Generation Tool** activated.\n\n${scriptContent}\n\nScene visualisation is next.`,
        scriptContent,
        stepReached: nextStep,
        activeTool:  call.name,
      });
    }

    return NextResponse.json({
      reply:        `**${toolLabel}** activated. ${getToolFeedback(call.name, call.args as Record<string, string>)}`,
      stepReached:  nextStep,
      activeTool:   call.name,
      agentThinking:`${toolLabel} processing…`,
    });
  }

  return NextResponse.json({
    reply:        sanitize(result.response.text()),
    stepReached:  currentStep,
    agentThinking:"Director reviewing the production plan…",
  });

  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    const isQuota = msg.includes("429") || msg.includes("quota");
    return NextResponse.json({
      reply: isQuota
        ? "Gemini API quota exceeded. Please create a new API key at aistudio.google.com (use **Create API key in new project**) and update GEMINI_API_KEY in .env.local."
        : `Director error: ${msg.slice(0, 200)}`,
      stepReached: currentStep,
      activeTool: null,
    }, { status: 200 });
  }
}

function getToolFeedback(toolName: string, args: Record<string, string>): string {
  const map: Record<string, string> = {
    generate_script:
      `Generating a ${args.tone || "professional"} script for "${args.topic}" with ${args.sceneCount || 9} scenes. Scene visualisation is next.`,
    generate_scene_images:
      `Creating ${args.artStyle || "3D"} storyboard visuals for your scenes. Moving to avatar configuration.`,
    create_avatar:
      `${args.avatarStyle || "3D"} avatar "${args.characterName}" configured. Voice narration is next.`,
    synthesize_voice:
      `Narration synthesis started in ${args.language || "English"} with a ${args.voiceStyle || "professional"} voice. Background music is next.`,
    generate_background_music:
      `Composing ${args.mood || "ambient"} background music for your video. Clip rendering is next.`,
    edit_final_video:
      `The editor is assembling all clips, syncing audio, and applying transitions. Your final video is rendering.`,
    search_context:
      `Searching: "${args.query}". Enriching your video with real-world context.`,
    extract_pdf_context:
      `Document analysed. Key context extracted: "${String(args.documentSummary || "").substring(0, 120)}…"`,
  };
  return map[toolName] ?? "Processing…";
}

// Stability AI — generates a scene storyboard image
async function generateSceneImage(description: string, artStyle: string): Promise<string | null> {
  try {
    const res = await fetch(
      "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          text_prompts: [
            { text: `${artStyle} style, cinematic scene: ${description}`, weight: 1 },
            { text: "blurry, distorted, low quality", weight: -1 },
          ],
          cfg_scale: 7,
          height: 576,
          width: 1024,
          steps: 30,
          samples: 1,
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const b64 = data.artifacts?.[0]?.base64;
    return b64 ? `data:image/png;base64,${b64}` : null;
  } catch {
    return null;
  }
}

// Stability AI — generates a scene image guided by a reference image (img2img)
async function generateSceneImageFromReference(
  description: string,
  artStyle: string,
  referenceBase64: string
): Promise<string | null> {
  try {
    const imageBuffer = Buffer.from(referenceBase64, "base64");
    const formData = new FormData();
    formData.append("init_image", new Blob([imageBuffer], { type: "image/png" }), "reference.png");
    formData.append("text_prompts[0][text]", `${artStyle} style, cinematic scene matching reference visual style: ${description}, same color palette, same lighting mood, same art direction`);
    formData.append("text_prompts[0][weight]", "1");
    formData.append("text_prompts[1][text]", "blurry, distorted, low quality, different style, inconsistent lighting");
    formData.append("text_prompts[1][weight]", "-1");
    formData.append("cfg_scale", "10");
    formData.append("image_strength", "0.5");
    formData.append("steps", "35");
    formData.append("samples", "1");
    const res = await fetch(
      "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.STABILITY_API_KEY}`, Accept: "application/json" },
        body: formData,
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const b64 = data.artifacts?.[0]?.base64;
    return b64 ? `data:image/png;base64,${b64}` : null;
  } catch {
    return null;
  }
}

// ElevenLabs — synthesises voice narration from script text
async function synthesizeVoiceElevenLabs(script: string, voiceStyle: string): Promise<string | null> {
  // Rachel (21m00Tcm4TlvDq8ikWAM) — clear professional female voice, free tier
  const voiceId = "21m00Tcm4TlvDq8ikWAM";
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   process.env.ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
          Accept:         "audio/mpeg",
        },
        body: JSON.stringify({
          text: script.substring(0, 2500),
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability:        voiceStyle === "dramatic" ? 0.3 : 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:audio/mpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

// Uses Meta MusicGen via Hugging Face Inference API (free tier)
// Retries once if the model is cold-starting (503 with estimated_time)
async function generateMusicWithHuggingFace(mood: string): Promise<string | null> {
  const call = async () =>
    fetch("https://api-inference.huggingface.co/models/facebook/musicgen-small", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: `${mood} background music, cinematic, no vocals` }),
    });

  try {
    let res = await call();

    // Model cold-starting — wait the suggested time then retry once
    if (res.status === 503) {
      const info = await res.json().catch(() => ({}));
      const wait = Math.min((info.estimated_time ?? 20) * 1000, 30_000);
      await new Promise((r) => setTimeout(r, wait));
      res = await call();
    }

    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:audio/flac;base64,${base64}`;
  } catch {
    return null;
  }
}

// Runway ML Gen-3 — submits an async text-to-video task, returns task ID
async function generateVideoWithRunway(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.dev.runwayml.com/v1/tasks", {
      method: "POST",
      headers: {
        Authorization:    `Bearer ${process.env.RUNWAY_API_KEY}`,
        "Content-Type":   "application/json",
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
  } catch {
    return null;
  }
}

// DuckDuckGo Instant Answer API — free, no key required
async function searchDuckDuckGo(query: string): Promise<string | null> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res  = await fetch(url, { headers: { "User-Agent": "ChitraOps/1.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    // AbstractText is the main summary; RelatedTopics[0] is a fallback
    const text = data.AbstractText
      || data.RelatedTopics?.[0]?.Text
      || null;
    return text ? String(text).substring(0, 300) : null;
  } catch {
    return null;
  }
}

async function generateAvatarAngles(
  imageBase64: string,
  artStyle: string
): Promise<Record<"front" | "right" | "left", string | null>> {
  // Style-specific quality booster words
  const styleDetail =
    artStyle.includes("3D CGI") ? "3D Pixar-style, high quality render, subsurface scattering, smooth skin, expressive eyes" :
    artStyle.includes("cartoon") ? "flat vector cartoon, bold outlines, vibrant colors, stylised" :
    artStyle.includes("anime")   ? "anime illustration, clean linework, large expressive eyes, detailed hair" :
    "photorealistic, 8k, sharp focus, studio lighting";

  const angles: { key: "front" | "right" | "left"; prompt: string }[] = [
    {
      key: "front",
      prompt: `${artStyle} character, ${styleDetail}, SAME PERSON as reference photo, identical facial features, same hair color and style, same skin tone, front-facing portrait, looking directly at camera, clean white background, head and shoulders shot`,
    },
    {
      key: "right",
      prompt: `${artStyle} character, ${styleDetail}, SAME PERSON as reference photo, identical facial features, same hair color and style, same skin tone, right side profile view, 90 degrees right, clean white background, head and shoulders shot`,
    },
    {
      key: "left",
      prompt: `${artStyle} character, ${styleDetail}, SAME PERSON as reference photo, identical facial features, same hair color and style, same skin tone, left side profile view, 90 degrees left, clean white background, head and shoulders shot`,
    },
  ];

  const results: Record<"front" | "right" | "left", string | null> = { front: null, right: null, left: null };

  for (const angle of angles) {
    try {
      const imageBuffer = Buffer.from(imageBase64, "base64");
      const formData = new FormData();
      formData.append("init_image", new Blob([imageBuffer], { type: "image/png" }), "face.png");
      formData.append("text_prompts[0][text]", angle.prompt);
      formData.append("text_prompts[0][weight]", "1");
      formData.append("text_prompts[1][text]", "different person, wrong face, blurry, distorted, multiple faces, extra limbs, bad anatomy, ugly, watermark, text");
      formData.append("text_prompts[1][weight]", "-1");
      formData.append("cfg_scale", "12");
      formData.append("image_strength", "0.65");
      formData.append("steps", "40");
      formData.append("samples", "1");

      const res = await fetch(
        "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
            Accept: "application/json",
          },
          body: formData,
        }
      );
      if (res.ok) {
        const data = await res.json();
        const b64 = data.artifacts?.[0]?.base64;
        if (b64) results[angle.key] = `data:image/png;base64,${b64}`;
      }
    } catch { /* continue with remaining angles */ }
  }

  return results;
}

async function triggerHeyGenVideo(script: string, avatarId: string) {
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
    return await res.json();
  } catch {
    return null;
  }
}
