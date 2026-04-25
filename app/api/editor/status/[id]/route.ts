import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key = process.env.SHOTSTACK_API_KEY;

  // No Shotstack key — caller should treat HeyGen video ID as the final URL
  if (!key) {
    return NextResponse.json({ status: "done", url: null, source: "heygen" });
  }

  try {
    const res = await fetch(`https://api.shotstack.io/edit/stage/render/${id}`, {
      headers: { "x-api-key": key },
    });
    if (!res.ok) return NextResponse.json({ status: "failed" });

    const data   = await res.json();
    const status = data.response?.status as string;

    if (status === "done") {
      return NextResponse.json({ status: "done", url: data.response.url, source: "shotstack" });
    }
    if (status === "failed") {
      return NextResponse.json({ status: "failed" });
    }
    return NextResponse.json({
      status:   "rendering",
      progress: data.response?.data?.progress ?? 0,
    });
  } catch {
    return NextResponse.json({ status: "failed" });
  }
}
