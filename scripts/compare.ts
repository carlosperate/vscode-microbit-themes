// Diffs two captures from `npm run mockups:capture` and writes the mockups that
// changed, cropped to the rows that changed, with a local index.html to review them.
// Usage: npm run mockups:compare -- <before> <after>
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Item = { theme: string; area: string };
type Rows = [number, number] | "size";

// Rows kept above and below the change, for context.
const PAD = 60;

const shots = join(import.meta.dirname, "..", ".screenshots");
const [before, after] = process.argv.slice(2);

// The first and last rows where more than a few pixels moved beyond rounding noise.
async function changedRows(a: string, b: string): Promise<Rows | null> {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = A.info;
  if (width !== B.info.width || height !== B.info.height) return "size";
  let first = -1;
  let last = -1;
  for (let y = 0; y < height; y++) {
    let moved = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
      if (d > 24) moved++;
    }
    if (moved > 2) {
      if (first < 0) first = y;
      last = y;
    }
  }
  return first < 0 ? null : [first, last];
}

async function writeCrop(src: string, rows: Rows, dest: string) {
  const { width, height } = await sharp(src).metadata();
  const [top, bottom] = rows === "size" ? [0, height!] : [Math.max(0, rows[0] - PAD), Math.min(height!, rows[1] + PAD)];
  await sharp(src)
    .extract({ left: 0, top, width: width!, height: bottom - top })
    .resize({ width: Math.round(width! / 2) })
    .webp({ quality: 82 })
    .toFile(dest);
}

const figure = ({ theme, area }: Item) => `<figure><figcaption>${area}</figcaption>
  <div class="before"><div class="tag">Before</div><img src="${theme}/${area}-before.webp" alt="${area} before"></div>
  <div class="after"><div class="tag">After</div><img src="${theme}/${area}-after.webp" alt="${area} after"></div></figure>`;

const section = (theme: string, items: Item[]) =>
  `<h2>${theme}</h2>\n${items.filter((i) => i.theme === theme).map(figure).join("\n")}`;

const page = (items: Item[]) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${before} vs ${after}</title>
<style>
  :root { color-scheme: light dark; --bg: #f3f4f1; --ink: #1b1d1a; --line: #d6d9d1; }
  @media (prefers-color-scheme: dark) { :root { --bg: #151714; --ink: #e6e9e3; --line: #333830; } }
  body { margin: 0; padding: 0 16px 48px; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, sans-serif; }
  header {
    position: sticky; top: 0; background: var(--bg); padding: 12px 0; border-bottom: 1px solid var(--line);
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  }
  h2 { margin: 32px 0 8px; } figure { margin: 0 0 24px; } figcaption { font-weight: 600; margin-bottom: 4px; }
  img { display: block; max-width: 100%; border: 1px solid var(--line); }
  .tag { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin: 6px 0 2px; }
  body.before .after, body.after .before { display: none; }
  button[aria-pressed="true"] { font-weight: 700; }
</style></head>
<body><header><strong>${before} → ${after}</strong> · ${items.length} changed ·
  <button data-v="both" aria-pressed="true">Both</button><button data-v="before">Before</button><button data-v="after">After</button></header>
${[...new Set(items.map((i) => i.theme))].map((theme) => section(theme, items)).join("\n")}
<script>
  for (const b of document.querySelectorAll("button")) b.onclick = () => {
    document.body.className = b.dataset.v === "both" ? "" : b.dataset.v;
    for (const o of document.querySelectorAll("button")) o.setAttribute("aria-pressed", String(o === b));
  };
</script></body></html>
`;

async function main() {
  if (!before || !after) throw new Error("usage: npm run mockups:compare -- <before> <after>");
  const out = join(shots, `${before}-vs-${after}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const items: Item[] = [];
  for (const theme of readdirSync(join(shots, before)).sort()) {
    for (const file of readdirSync(join(shots, before, theme)).sort()) {
      const a = join(shots, before, theme, file);
      const b = join(shots, after, theme, file);
      // Most mockups do not change at all, and a byte compare is far cheaper than decoding.
      if (!existsSync(b) || readFileSync(a).equals(readFileSync(b))) continue;
      const rows = await changedRows(a, b);
      if (!rows) continue;
      const area = file.replace(/\.png$/, "");
      mkdirSync(join(out, theme), { recursive: true });
      await Promise.all([
        writeCrop(a, rows, join(out, theme, `${area}-before.webp`)),
        writeCrop(b, rows, join(out, theme, `${area}-after.webp`)),
      ]);
      if (rows === "size") console.warn(`${theme}/${area}: sizes differ, the shots were taken at different window sizes`);
      items.push({ theme, area });
    }
  }
  writeFileSync(join(out, "index.html"), page(items));
  console.log(`${items.length} mockups changed → ${join(out, "index.html")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
