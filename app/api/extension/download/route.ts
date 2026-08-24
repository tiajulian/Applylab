import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const zipPath = path.resolve(process.cwd(), "public/downloads/applylab-extension.zip");

    if (!fs.existsSync(zipPath)) {
      return NextResponse.json({ error: "Extension ZIP package not found." }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(zipPath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="applylab-extension.zip"',
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("extension-download error", error);
    return NextResponse.json({ error: "Failed to download extension ZIP" }, { status: 500 });
  }
}
