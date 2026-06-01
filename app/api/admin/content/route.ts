import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const htmlContent = await fs.readFile(
      join(process.cwd(), "zeno_ai_admin_ENTERPRISE.html"),
      "utf-8"
    );

    // Replace ZENO with NEXOUARA in the HTML
    const modifiedHtml = htmlContent
      .replace(/ZENO/g, "NEXOUARA")
      .replace(/Zeno/g, "Nexouara");

    return new NextResponse(modifiedHtml, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load admin content" },
      { status: 500 }
    );
  }
}