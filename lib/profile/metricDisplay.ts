// A figure and its unit: "6.8 days", "40%", "40 per cent", "$2m", "1,200", "3x". The unit is optional.
const FIGURE =
  /(\$)?\s?(\d[\d,]*(?:\.\d+)?)\s*(%|per\s?cent\b|x\b|k\b|m\b|million\b|thousand\b|billion\b|days?\b|hours?\b|hrs?\b|weeks?\b|months?\b|minutes?\b|mins?\b|seconds?\b|secs?\b)?/gi;

interface Figure {
  value: number;
  unit: string;
}

/** One spelling per unit: "per cent" -> "%", "m" -> "million", "hrs" -> "hour", "days" -> "day". */
function unitKey(unit: string | undefined): string {
  const u = (unit ?? "").toLowerCase().replace(/\s+/g, "");
  if (u === "percent") return "%";
  if (u === "m") return "million";
  if (u === "k") return "thousand";
  if (u === "hr" || u === "hrs") return "hour";
  if (u === "min" || u === "mins") return "minute";
  if (u === "sec" || u === "secs") return "second";
  return u.endsWith("s") ? u.slice(0, -1) : u;
}

function figuresIn(text: string): Figure[] {
  return Array.from(text.matchAll(FIGURE), (m) => ({
    value: Number(m[2].replace(/,/g, "")),
    unit: (m[1] ? "$" : "") + unitKey(m[3]),
  })).filter((f) => Number.isFinite(f.value));
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.01);

/** The text states `metric` outright, or as a before -> after pair it's the change of. */
function stated(metric: Figure, figures: Figure[]): boolean {
  if (figures.some((f) => f.unit === metric.unit && close(f.value, metric.value))) return true;
  const sameUnit = figures.filter((f) => f.unit === metric.unit);
  for (let i = 0; i + 1 < sameUnit.length; i++) {
    const [before, after] = [sameUnit[i].value, sameUnit[i + 1].value];
    if (close(Math.abs(before - after), metric.value)) return true;
    // "from 10% to 6%" stated as a 40% drop.
    if (metric.unit === "%" && before !== 0 && close((Math.abs(before - after) / before) * 100, metric.value)) return true;
  }
  return false;
}

/**
 * Whether a line's saved metric should be shown after its text. Hidden only when the line already
 * states that exact result - the same figure ("40 per cent" / "40%"), or a before -> after pair the
 * metric is the change of ("from 6.8 to 1.4 days" / "5.4 days") - since repeating it reads as a
 * third, unexplained figure. Any other number in the line ("a $2m budget", "a 24 hour desk") leaves
 * the metric showing. Hiding never changes what's saved or used.
 */
export function showMetric(text: string, metric: string | undefined): boolean {
  if (!metric?.trim()) return false;
  const textFigures = figuresIn(text);
  const metricFigures = figuresIn(metric);
  return metricFigures.length === 0 || !metricFigures.every((figure) => stated(figure, textFigures));
}
