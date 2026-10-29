import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/requireUser", () => ({ requireUser, UnauthorizedError: class extends Error {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceRoleClient: vi.fn() }));
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { PATCH } from "./route";

let read: Record<string, ReturnType<typeof vi.fn>>;
let write: Record<string, ReturnType<typeof vi.fn>>;
let update: ReturnType<typeof vi.fn>;
let existing: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ authUserId: "user" });
  read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "bridge", user_id: "user" } }) };
  write = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "item", user_state: "confirmed" } }) };
  update = vi.fn(() => write);
  vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => read) } as never);
  existing = { id: "item", state: "to_confirm", user_state: "pending", user_note: null, source_company: "Acme", source_job_title: "Analyst" };
  const itemRead = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: existing }) };
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn(() => ({ ...itemRead, update })) } as never);
});
const body = { user_state: "confirmed", user_note: "Trained new starters.", expected_user_state: "pending", expected_user_note: null,
  expected_source: { state: "to_confirm", company: "Acme", job_title: "Analyst" } };
function request(data: unknown = body) {
  return PATCH(new Request("http://localhost/api/skills-bridge/bridge/items/item", { method: "PATCH", body: JSON.stringify(data) }), { params: Promise.resolve({ bridgeId: "bridge", itemId: "item" }) });
}
describe("conditional inline Skill Gap answers", () => {
  it.each(["state", "source_company", "source_job_title"])("rejects a stale answer if its %s changed before this request", async (field) => {
    existing[field] = field === "state" ? "matched" : "Another role";
    expect((await request()).status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects malformed expected source metadata", async () => {
    expect((await request({ ...body, expected_source: { company: "Acme" } })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it("checks ownership and saves only if the original answer is unchanged", async () => {
    expect((await request()).status).toBe(200);
    expect(read.eq).toHaveBeenCalledWith("user_id", "user");
    expect(write.eq).toHaveBeenCalledWith("bridge_id", "bridge");
    expect(write.eq).toHaveBeenCalledWith("user_state", "pending");
    expect(write.eq).toHaveBeenCalledWith("state", "to_confirm");
    expect(write.is).toHaveBeenCalledWith("user_note", null);
    expect(update).toHaveBeenCalledWith({ user_state: "confirmed", user_note: "Trained new starters." });
  });
  it("reports a conflict rather than overwriting another tab's answer", async () => {
    write.maybeSingle.mockResolvedValue({ data: null });
    expect((await request()).status).toBe(409);
  });
  it("rejects empty examples and partial concurrency fields", async () => {
    expect((await request({ ...body, user_note: " " })).status).toBe(400);
    expect((await request({ ...body, expected_user_note: undefined })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it("does not allow conditional answers to write profile data", async () => {
    expect((await request({ ...body, save_to_profile: true })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it("refuses an unowned bridge before reading or updating an item", async () => {
    read.maybeSingle.mockResolvedValue({ data: null });
    expect((await request()).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });
  it("keeps the existing nonconditional update contract", async () => {
    expect((await request({ user_state: "rejected" })).status).toBe(200);
    expect(write.is).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ user_state: "rejected" });
  });
});
