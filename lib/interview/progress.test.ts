import { describe, it, expect } from "vitest";
import { sessionProgress } from "./progress";
import type { InterviewTurn } from "@/types";

function turn(id: string, order: number, opts: Partial<InterviewTurn> = {}): InterviewTurn {
  return {
    id,
    session_id: "s1",
    order_index: order,
    question_type: "behavioural",
    question_text: `Q ${id}`,
    is_followup: false,
    parent_turn_id: null,
    transcript: null,
    answer_source: null,
    duration_sec: null,
    wpm: null,
    filler_count: null,
    star_scores: null,
    content_feedback: null,
    delivery_feedback: null,
    suggested_answer: null,
    audio_url: null,
    created_at: "",
    ...opts,
  };
}

const eight = () => Array.from({ length: 8 }, (_, i) => turn(`m${i + 1}`, i + 1));

describe("sessionProgress", () => {
  it("counts main questions only", () => {
    const turns = eight();
    turns[0].transcript = "a";
    turns[1].transcript = "b";
    const p = sessionProgress(turns, "m3");
    expect(p.label).toBe("Question 3 of 8");
    expect(p.total).toBe(8);
  });

  it("never changes the total when a follow-up is added", () => {
    const turns = eight().map((t) => (t.order_index >= 4 ? { ...t, order_index: t.order_index + 1 } : t));
    turns[0].transcript = "a";
    turns[1].transcript = "b";
    turns[2].transcript = "c";
    turns.push(turn("f3", 4, { is_followup: true, parent_turn_id: "m3" }));

    const onFollowup = sessionProgress(turns, "f3");
    expect(onFollowup.total).toBe(8);
    expect(onFollowup.isFollowup).toBe(true);
    expect(onFollowup.label).toBe("Follow-up to question 3");

    const afterFollowup = sessionProgress(turns, "m4");
    expect(afterFollowup.label).toBe("Question 4 of 8");
  });

  it("puts follow-ups inside their parent's segment", () => {
    const turns = [...eight(), turn("f1", 2, { is_followup: true, parent_turn_id: "m1" })];
    const p = sessionProgress(turns, "f1");
    expect(p.segments).toHaveLength(8);
    expect(p.segments[0].followups).toEqual([{ turnId: "f1", answered: false, current: true }]);
    expect(p.segments[0].current).toBe(true);
  });
});
