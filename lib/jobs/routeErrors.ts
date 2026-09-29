import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/requireUser";
import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";

/** Shared catch block: 401 for auth, the AI gateway's own refusals, otherwise a logged 500. */
export function jobsErrorResponse(error: unknown, context: string, message: string): NextResponse {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const aiRefusal = aiErrorResponse(error);
  if (aiRefusal) return aiRefusal;
  console.error(`${context} error`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
