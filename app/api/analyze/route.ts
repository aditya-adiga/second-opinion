import { NextRequest, NextResponse } from "next/server";

import { analyzeChartImage, ClaudeCliError } from "@/lib/claude-cli";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the submitted form." }, { status: 400 });
  }

  const image = formData.get("image");
  const context = formData.get("context");

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "Please choose an image to upload." }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.has(image.type)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${image.type || "unknown"}. Use PNG, JPEG, WEBP, or GIF.` },
      { status: 400 },
    );
  }

  const contextText = typeof context === "string" ? context : "";

  try {
    const buffer = Buffer.from(await image.arrayBuffer());
    const result = await analyzeChartImage(buffer, image.type, contextText);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof ClaudeCliError ? err.message : "Something went wrong analyzing the image.";
    console.error("analyze route failed:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
