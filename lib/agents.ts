// Define the roles for your Production Studio
export const AGENT_ROLES = {
  DIRECTOR: "Director Agent: Manages workflow and approves output.",
  SCRIPTWRITER: "Scriptwriter Agent: Converts boring PDFs into dramatic Netflix scripts.",
  SET_DESIGNER: "Set Designer Agent: Generates prompts for background environments.",
  CHARACTER_AGENT: "Character Agent: Configures the HeyGen avatar look and voice.",
  VIDEO_GEN: "Video Generator: Triggers the final video assembly."
};

// This is how Gemini 'calls' the agents
export const studioTools = [
  { name: "generate_script", description: "Creates a 3-act script from a PDF or text." },
  { name: "design_scene", description: "Generates visual descriptions for the video background." },
  { name: "configure_avatar", description: "Selects the best character (Antoine, Justin, etc.) for the topic." },
  { name: "finalize_video", description: "Stitches script and avatar together." }
];