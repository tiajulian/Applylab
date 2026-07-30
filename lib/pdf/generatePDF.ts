import type { Browser } from "puppeteer-core";
import { createElement } from "react";
import { ATSSafeTemplate } from "@/components/templates/ATSSafeTemplate";
import { DesignForwardTemplate } from "@/components/templates/DesignForwardTemplate";
import type { ResumeContent, Template } from "@/types";

function wrapHtml(bodyMarkup: string): string {
  return `<!DOCTYPE html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 18mm 16mm; }
      * { box-sizing: border-box; }
      body { margin: 0; }
    </style>
  </head>
  <body>${bodyMarkup}</body>
</html>`;
}

// Vercel (and most serverless hosts) impose a function bundle size limit that a full
// puppeteer install (with its bundled Chromium) blows past — so on Vercel we launch
// puppeteer-core against @sparticuz/chromium's serverless-sized Chromium binary instead.
// Locally (and on any non-Vercel host) we fall back to full puppeteer, which manages its own
// bundled Chromium — no native binary path to wire up for local dev.
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = await import("puppeteer-core");
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true });
  return browser as unknown as Browser;
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "a4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateResumePDF(
  resume: ResumeContent,
  template: Template
): Promise<Buffer> {
  const { renderToStaticMarkup } = await import("react-dom/server");

  const markup = renderToStaticMarkup(
    template === "design-forward"
      ? createElement(DesignForwardTemplate, { resume })
      : createElement(ATSSafeTemplate, { resume })
  );

  return renderPdf(wrapHtml(markup));
}

export async function generateCoverLetterPDF(coverLetter: string): Promise<Buffer> {
  const paragraphs = coverLetter
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p style="margin:0 0 14px;">${escapeHtml(line)}</p>`)
    .join("");

  const markup = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a;">${paragraphs}</div>`;

  return renderPdf(wrapHtml(markup));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
