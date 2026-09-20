import { sideSegments, type DiffSegment } from "@/lib/review/diff";

/** Added words: bold + underline + a soft green wash, so the change is never colour alone. */
function Added({ children }: { children: string }) {
  return <ins className="rounded-sm bg-success/15 font-bold text-ink underline decoration-2 underline-offset-2">{children}</ins>;
}

/** Removed words: struck through in red, with the strike doing the work if the red is not seen. */
function Removed({ children }: { children: string }) {
  return <del className="text-critical line-through decoration-2">{children}</del>;
}

/** The full text of one side of a diff, changed words marked. Long lines wrap; nothing is truncated. */
export function WordDiff({ diff, side }: { diff: DiffSegment[]; side: "add" | "del" }) {
  const Mark = side === "add" ? Added : Removed;
  return (
    <>
      {sideSegments(diff, side).map((seg, i) => (seg.kind === "same" ? <span key={i}>{seg.text}</span> : <Mark key={i}>{seg.text}</Mark>))}
    </>
  );
}
