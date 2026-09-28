// Screenshots every Theme Builder mockup, per theme, from a session started with
// `npm run desktop -- --cdp-port=9223`, into .screenshots/<label>/<theme>/<area>.png.
// Usage: npm run mockups:capture -- <label> ["micro:bit Spark Dark" …]
import { chromium, type Frame, type Page } from "playwright-core";
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type ThemeEntry = { label: string; path: string };

const CDP = `http://localhost:${process.env.CDP_PORT ?? 9223}`;
const VIEWPORT = { width: 1440, height: 900 };

const root = join(import.meta.dirname, "..");
const themes: ThemeEntry[] = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).contributes.themes;
const [label, ...only] = process.argv.slice(2);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const nextPaint = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

// Clicks the row labelled exactly `text`: the top match is often a recently used neighbour.
async function choose(page: Page, query: string, text: string) {
  await page.locator(".quick-input-widget input.input").fill(query);
  const row = page.locator(".quick-input-widget .monaco-list-row").filter({ has: page.getByText(text, { exact: true }) });
  await row.first().click({ timeout: 5000 });
}

async function command(page: Page, name: string) {
  await page.keyboard.press("Escape");
  await page.keyboard.press("F1");
  await choose(page, `>${name}`, name);
}

async function setTheme(page: Page, theme: ThemeEntry) {
  await command(page, "Preferences: Color Theme");
  await page.locator('.quick-input-widget input.input[aria-label*="Color Theme"]').waitFor();
  await choose(page, theme.label, theme.label);
  const background = JSON.parse(readFileSync(join(root, theme.path), "utf8")).colors["editor.background"].toLowerCase();
  await page.waitForFunction(
    (bg) => getComputedStyle(document.querySelector(".monaco-workbench")!).getPropertyValue("--vscode-editor-background").trim() === bg,
    background,
  );
}

// Reopened for each theme: a webview from before the CDP connection is invisible to
// Playwright, and a new one reads the current colours.
async function openThemeBuilder(page: Page): Promise<Frame> {
  await command(page, "View: Close All Editors");
  await command(page, "Theme Builder: Theme Builder: Open");
  for (let i = 0; i < 40; i++) {
    const frame = page.frames().find((f) => f.url().includes("fake.html"));
    if (frame) {
      await frame.locator("li.area-list__item").first().waitFor();
      // Only the mockup is compared, so it takes the full width.
      await frame.addStyleTag({
        content: `.app { grid-template-columns: 0 0 0 0 1fr !important }
          .app__sidebar, .app__inspector, .app__splitter { visibility: hidden }`,
      });
      return frame;
    }
    await page.waitForTimeout(250);
  }
  throw new Error("Theme Builder did not open");
}

async function showArea(frame: Frame, area: string) {
  await frame.locator("li.area-list__item").filter({ has: frame.getByText(area, { exact: true }) }).dispatchEvent("click");
  await frame.waitForFunction((a) => document.querySelector(".app__main-content h2")?.textContent?.trim() === a, area);
  await frame.evaluate(nextPaint);
}

// Element screenshots hang inside a webview, so this clips page screenshots and stitches the scroll.
async function captureMockup(page: Page, frame: Frame, file: string) {
  const pane = frame.locator(".app__main-content");
  const clip = (await pane.boundingBox())!;
  const { scrollHeight, clientHeight } = await pane.evaluate((e) => ({ scrollHeight: e.scrollHeight, clientHeight: e.clientHeight }));
  const parts: Array<{ top: number; input: Buffer }> = [];
  for (let y = 0; ; y += clientHeight) {
    const top = await pane.evaluate((e, y) => ((e.scrollTop = y), e.scrollTop), y);
    await frame.evaluate(nextPaint);
    parts.push({ top, input: await page.screenshot({ clip }) });
    // scrollTop clamps on the last page, fractionally at 2x.
    if (top < y || top + clientHeight >= scrollHeight - 1) break;
  }
  const { width, height } = await sharp(parts[0].input).metadata();
  const scale = height! / clientHeight;
  const canvas = { width: width!, height: Math.round(scrollHeight * scale), channels: 4 as const, background: "#00000000" };
  await sharp({ create: canvas })
    .composite(parts.map((p) => ({ input: p.input, top: Math.round(p.top * scale), left: 0 })))
    .png()
    .toFile(file);
  await pane.evaluate((e) => (e.scrollTop = 0));
}

async function main() {
  if (!label) throw new Error("usage: npm run mockups:capture -- <label> [theme …]");
  const browser = await chromium.connectOverCDP(CDP);
  const page = browser.contexts()[0].pages().find((p) => p.url().includes("workbench.html"));
  if (!page) throw new Error(`no VS Code window on ${CDP}`);
  // A fixed viewport keeps shots from different sessions and window sizes comparable.
  await page.setViewportSize(VIEWPORT);
  try {
    for (const theme of themes.filter((t) => !only.length || only.includes(t.label))) {
      await setTheme(page, theme);
      const frame = await openThemeBuilder(page);
      const areas = (await frame.locator("li.area-list__item .area-list__label").allTextContents()).map((a) => a.trim());
      const dir = join(root, ".screenshots", label, slug(theme.label));
      mkdirSync(dir, { recursive: true });
      for (const area of areas) {
        await showArea(frame, area);
        await captureMockup(page, frame, join(dir, `${slug(area)}.png`));
      }
      console.log(`${theme.label}: ${areas.length} areas → ${dir}`);
    }
  } finally {
    // Disconnects only; the VS Code window stays open.
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
