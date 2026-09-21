// k6 burst test for the rate limiter. Proves that under parallel load the number of requests the
// limiter ADMITS never exceeds the cap (the old read-then-write race let a burst overshoot).
//
// RUN AGAINST STAGING ONLY, with a dedicated test account. Requests that pass the limiter reach
// the real handler: the AI routes below will make real (cheap) provider calls. Keep the provider
// keys on staging on a low spend cap, or point them at a stub.
//
//   k6 run \
//     -e BASE_URL=https://staging.example.com \
//     -e COOKIE='sb-<ref>-auth-token=...'          # a logged-in PRO test user's session cookie
//     -e RESUME_ID=<uuid of that user's resume>    # for the generate-pdf scenario
//     scripts/loadtest/rate-limit-burst.js
//
// Each scenario fires BURST simultaneous requests (all VUs start at once) and counts how many
// were admitted (any status other than 429/503). The threshold fails the run if admitted > cap.
// Caps below must match the route's current limits (change them in the route/policies, then here).
//
// Use a fresh test user (or wait out the window) between runs: counters persist for the window.
import http from "k6/http";
import { Counter } from "k6/metrics";

const BASE = __ENV.BASE_URL;
const COOKIE = __ENV.COOKIE;
const RESUME_ID = __ENV.RESUME_ID;
const BURST = 60;

const admitted = {
  parse_job_ad: new Counter("admitted_parse_job_ad"),
  skills_bridge: new Counter("admitted_skills_bridge"),
  generate_pdf: new Counter("admitted_generate_pdf"),
};

const scenario = (exec) => ({
  executor: "per-vu-iterations",
  vus: BURST,
  iterations: 1,
  maxDuration: "2m",
  exec,
});

export const options = {
  scenarios: {
    parse_job_ad: scenario("parseJobAd"), // user-scoped AI route, cap 10 / minute
    skills_bridge: { ...scenario("skillsBridge"), startTime: "20s" }, // user + IP, cap 15 / hour per IP
    generate_pdf: { ...scenario("generatePdf"), startTime: "40s" }, // cap 10 / 10 min + 1 concurrent
  },
  thresholds: {
    admitted_parse_job_ad: ["count<=10"],
    admitted_skills_bridge: ["count<=10"], // user cap is 10/hour; the IP cap (15) is looser
    admitted_generate_pdf: ["count<=10"],
  },
};

const headers = { "Content-Type": "application/json", Cookie: COOKIE, Origin: BASE };
const wasLimited = (res) => res.status === 429 || res.status === 503;

export function parseJobAd() {
  const res = http.post(
    `${BASE}/api/parse-job-ad`,
    JSON.stringify({ adText: "Senior Engineer at ExampleCo. ".repeat(20) }),
    { headers }
  );
  if (!wasLimited(res)) admitted.parse_job_ad.add(1);
}

export function skillsBridge() {
  const res = http.post(
    `${BASE}/api/skills-bridge`,
    JSON.stringify({
      jobTitle: "Engineer",
      companyName: "ExampleCo",
      jobDescription: "Build things. ".repeat(30),
      turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", // staging must use Cloudflare's always-pass test keys
    }),
    { headers }
  );
  if (!wasLimited(res)) admitted.skills_bridge.add(1);
}

export function generatePdf() {
  const res = http.post(`${BASE}/api/generate-pdf`, JSON.stringify({ resumeId: RESUME_ID, type: "resume" }), {
    headers,
    timeout: "90s",
  });
  if (!wasLimited(res)) admitted.generate_pdf.add(1);
}
