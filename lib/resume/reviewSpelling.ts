import { readFile } from "node:fs/promises";
import path from "node:path";
import nspell from "nspell";
import { listBlocks } from "@/lib/review/blocks";
import { spellingItems } from "@/lib/review/rules";
import { buildKnownWords } from "@/lib/text/spellcheck";
import { hashForScoring } from "./scoreCache";
import { targetForBlock } from "./reviewActions";
import type { ResumeContent, ResumeReviewFinding } from "@/types";

let checkerPromise: Promise<ReturnType<typeof nspell>> | null = null;
function getChecker() {
  if (!checkerPromise) {
    checkerPromise = Promise.all([
      readFile(path.join(process.cwd(), "public/dictionaries/en-au/en-au.aff")),
      readFile(path.join(process.cwd(), "public/dictionaries/en-au/en-au.dic")),
    ]).then(([aff, dic]) => nspell(aff, dic)).catch((error) => {
      checkerPromise = null;
      throw error;
    });
  }
  return checkerPromise;
}

/** Supplement cached reviews without another AI call. Reuse the editor's AU spelling rules. */
export async function withReviewSpelling(content: ResumeContent, findings: ResumeReviewFinding[]): Promise<ResumeReviewFinding[]> {
  const existing = findings.filter((f) => !f.id.startsWith("review-spelling-") || f.status === "applied" || f.status === "dismissed");
  try {
    const checker = await getChecker();
    const knownWords = buildKnownWords(content);
    const spelling: ResumeReviewFinding[] = [];
    for (const block of listBlocks(content)) {
      const target = targetForBlock(block.id);
      if (!target) continue;
      for (const item of spellingItems(block, { checker, knownWords })) {
        const id = `review-spelling-${hashForScoring(block.id, block.text, String(item.start)).slice(0, 24)}`;
        if (existing.some((f) => f.id === id)) continue;
        spelling.push({
          id, category_key: "writing_quality", severity: "info", status: "open",
          title: item.reason, detail: "Check this spelling. Names and specialist terms may already be correct.",
          replacement: item.after ? block.text.slice(0, item.start) + item.after + block.text.slice(item.end) : undefined,
          fix_text: item.after ? undefined : "Edit the spelling if needed, or keep your wording.",
          bullet_text: block.text, target, resume_location: block.label,
        });
        if (spelling.length >= 20) return [...existing, ...spelling];
      }
    }
    return [...existing, ...spelling];
  } catch (error) {
    console.error("Resume review spelling unavailable", error);
    return findings;
  }
}
