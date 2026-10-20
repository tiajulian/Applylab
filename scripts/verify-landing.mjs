import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
// Node strips the types from this dependency-free .ts file, so the script and app share one list.
import { BANNED_TERMS } from "../lib/marketing/copy.ts";
import { STORIES, STORIES_SECTION_MIN } from "../lib/stories.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACT_DIR =
  process.env.SCREENSHOT_DIR ?? "C:/Users/tiaju/.gemini/antigravity-ide/brain/b00fb1ea-4239-4903-99ea-28b17e3f1be6";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
// Marketing pages whose rendered text must contain none of BANNED_TERMS.
const COPY_CHECK_PATHS = ["/", "/pricing", "/resume-score", "/blog"];

const failures = [];
function fail(message) {
  console.error(`  ✗ ${message}`);
  failures.push(message);
}

async function verify() {
  console.log("Starting automated landing page verification...");
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.toString());
  });

  // 1. Desktop 1440px
  await page.setViewport({ width: 1440, height: 900 });
  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#site-header", { timeout: 10000 });

  // Verify Nav Anchors, in page order (#stories only renders once there are enough real quotes)
  const showStories = STORIES.length >= STORIES_SECTION_MIN;
  const anchorIds = ["score", "how", "stand-out", "interview", ...(showStories ? ["stories"] : []), "templates", "pricing", "faq"];

  for (const id of anchorIds) {
    const el = await page.$(`#${id}`);
    if (el) {
      console.log(`  ✓ Section #${id} found`);
    } else {
      fail(`Section #${id} MISSING!`);
    }
  }
  if (!showStories && (await page.$("#stories"))) fail("#stories renders without enough real stories");

  // Every landing section carries data-section, in this order
  const expectedSections = ["hero", "portals", ...anchorIds, "final"];
  const sections = await page.$$eval("main > section", (els) => els.map((el) => el.dataset.section ?? "(none)"));
  if (sections.join() === expectedSections.join()) {
    console.log("  ✓ Sections render in the expected order");
  } else {
    fail(`Section order is ${sections.join(", ")}; expected ${expectedSections.join(", ")}`);
  }

  // Neighbouring sections need different backgrounds (the final CTA is its own band, so it's skipped)
  const sameBackground = await page.$$eval("main > section", (els) => {
    const bgs = els.filter((el) => el.dataset.section !== "final").map((el) => [el.dataset.section, getComputedStyle(el).backgroundColor]);
    return bgs.slice(1).flatMap(([id, bg], i) => (bg === bgs[i][1] ? [`${bgs[i][0]}/${id}`] : []));
  });
  if (sameBackground.length === 0) {
    console.log("  ✓ Neighbouring sections alternate backgrounds");
  } else {
    fail(`Neighbouring sections share a background: ${sameBackground.join(", ")}`);
  }

  // Every link to sign up or to the score carries a data-cta, and no two share one (menu links
  // are navigation, so in the header only the button counts)
  const ctas = await page.$$eval(
    'main a[href="/onboarding"], main a[href="#score"], main a[href="/pricing"], #site-header a.btn',
    (els) => els.map((el) => el.dataset.cta ?? null)
  );
  const missingCta = ctas.filter((cta) => !cta).length;
  const dupCtas = ctas.filter((cta, i) => cta && ctas.indexOf(cta) !== i);
  if (missingCta === 0 && dupCtas.length === 0) {
    console.log(`  ✓ All ${ctas.length} CTAs have a unique data-cta`);
  } else {
    if (missingCta) fail(`${missingCta} CTA link(s) missing data-cta`);
    if (dupCtas.length) fail(`Duplicate data-cta: ${dupCtas.join(", ")}`);
  }

  // Hero and final secondary CTAs go to the free score
  for (const cta of ["hero-score", "final-score"]) {
    const href = await page.$eval(`[data-cta="${cta}"]`, (el) => el.getAttribute("href")).catch(() => null);
    if (href === "#score") console.log(`  ✓ ${cta} links to #score`);
    else fail(`${cta} links to ${href}, expected #score`);
  }

  // Templates: 4 shown, the rest behind an aria-expanded disclosure
  const visibleTemplates = () => page.$$eval("#templates .tmpl", (els) => els.filter((el) => el.offsetParent !== null).length);
  // The button only works once React has hydrated
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});
  const toggle = await page.$('[data-cta="templates-see-all"]');
  const shownBefore = await visibleTemplates();
  const expandedBefore = await toggle?.evaluate((el) => el.getAttribute("aria-expanded"));
  // Retry the click: before hydration the server-rendered button has no handler yet
  for (let i = 0; i < 20 && (await toggle?.evaluate((el) => el.getAttribute("aria-expanded"))) !== "true"; i++) {
    await toggle?.evaluate((el) => el.click());
    await new Promise((r) => setTimeout(r, 250));
  }
  const shownAfter = await visibleTemplates();
  const expandedAfter = await toggle?.evaluate((el) => el.getAttribute("aria-expanded"));
  if (shownBefore === 4 && shownAfter === 8 && expandedBefore === "false" && expandedAfter === "true") {
    console.log("  ✓ Templates show 4, then 8 with aria-expanded");
  } else {
    fail(`Templates disclosure: ${shownBefore} -> ${shownAfter} shown, aria-expanded ${expandedBefore} -> ${expandedAfter}`);
  }

  // Verify 8 Template images
  const templates = ["clean", "classic", "modern", "compact", "editorial", "technical", "executive", "minimal"];
  for (const tmpl of templates) {
    const imgSelector = `img[src*="${tmpl}.webp"]`;
    const imgEl = await page.$(imgSelector);
    if (imgEl) {
      console.log(`  ✓ Template preview image ${tmpl} loaded`);
    } else {
      fail(`Template preview image ${tmpl} missing!`);
    }
  }

  // Every in-page link (#x or /#x) on the homepage must resolve to an element that exists
  const brokenAnchors = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"], a[href^="/#"]')]
      .map((a) => a.getAttribute("href"))
      .filter((href) => !document.getElementById(href.replace(/^\/?#/, "")))
  );
  if (brokenAnchors.length === 0) {
    console.log("  ✓ All in-page links resolve");
  } else {
    for (const href of new Set(brokenAnchors)) fail(`Link ${href} points to a missing id`);
  }

  // Capture desktop hero screenshot
  const heroScreenshotPath = path.join(ARTIFACT_DIR, "screenshot_desktop_hero.png");
  await page.screenshot({ path: heroScreenshotPath, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log("  ✓ Saved screenshot_desktop_hero.png");

  // Scroll through each section to trigger reveals and animations
  for (const id of anchorIds) {
    await page.evaluate((elId) => {
      const el = document.getElementById(elId);
      if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
    }, id);
    await new Promise((r) => setTimeout(r, 150));
  }

  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 500));

  // Capture full page desktop screenshot
  const fullScreenshotPath = path.join(ARTIFACT_DIR, "screenshot_desktop_full.png");
  await page.screenshot({ path: fullScreenshotPath, fullPage: true });
  console.log("  ✓ Saved screenshot_desktop_full.png");

  // 2. Tablet 768px
  await page.setViewport({ width: 768, height: 1024 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  const tabletScreenshotPath = path.join(ARTIFACT_DIR, "screenshot_tablet.png");
  await page.screenshot({ path: tabletScreenshotPath, clip: { x: 0, y: 0, width: 768, height: 1000 } });
  console.log("  ✓ Saved screenshot_tablet.png");

  // 3. Mobile 375px
  await page.setViewport({ width: 375, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  const mobileHeroScreenshotPath = path.join(ARTIFACT_DIR, "screenshot_mobile_hero.png");
  await page.screenshot({ path: mobileHeroScreenshotPath, clip: { x: 0, y: 0, width: 375, height: 812 } });
  console.log("  ✓ Saved screenshot_mobile_hero.png");

  // Test Mobile Burger Toggle
  const burgerBtn = await page.$(".burger");
  if (burgerBtn) {
    await burgerBtn.click();
    await new Promise((r) => setTimeout(r, 300));
    const mobileMenuOpenPath = path.join(ARTIFACT_DIR, "screenshot_mobile_menu_open.png");
    await page.screenshot({ path: mobileMenuOpenPath, clip: { x: 0, y: 0, width: 375, height: 600 } });
    console.log("  ✓ Saved screenshot_mobile_menu_open.png");
  }

  // Banned vocabulary check across the main marketing pages (case-insensitive)
  await page.setViewport({ width: 1440, height: 900 });
  for (const pathname of COPY_CHECK_PATHS) {
    await page.goto(`${BASE_URL}${pathname}`, { waitUntil: "networkidle2" });
    // textContent, not innerText, so closed <details> answers and hidden menus still count; minus
    // <script>/<style>, whose serialised page data (e.g. full blog post bodies) isn't rendered copy
    const text = (
      await page.evaluate(() => {
        const body = document.body.cloneNode(true);
        body.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
        return body.textContent ?? "";
      })
    ).toLowerCase();
    const found = BANNED_TERMS.filter((term) => text.includes(term.toLowerCase()));
    if (found.length === 0) {
      console.log(`  ✓ ${pathname}: no banned terms`);
    } else {
      fail(`${pathname}: banned terms found: ${found.join(", ")}`);
    }
  }

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error("Console errors encountered during verification:", consoleErrors);
  } else {
    console.log("✓ Zero console errors encountered!");
  }

  if (failures.length > 0) {
    console.error(`Verification failed with ${failures.length} problem(s).`);
    process.exit(1);
  }
  console.log("Verification finished successfully!");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
