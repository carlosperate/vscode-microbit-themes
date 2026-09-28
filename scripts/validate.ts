// Parses the generated themes and checks all six declare the same keys.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "themes");
const keySets = readdirSync(dir).map((file) => {
  const theme = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const colors = Object.keys(theme.colors).sort();
  const tokenColors = theme.tokenColors.map((t: { name: string }) => t.name).sort();
  const semanticTokenColors = Object.keys(theme.semanticTokenColors).sort();
  console.log(`${file}: ${colors.length} colors, ${tokenColors.length} tokenColors, ${semanticTokenColors.length} semanticTokenColors`);
  return { file, keys: JSON.stringify([colors, tokenColors, semanticTokenColors]) };
});

const odd = keySets.filter((s) => s.keys !== keySets[0].keys);
if (odd.length) {
  console.error(`Key sets differ from ${keySets[0].file}: ${odd.map((s) => s.file).join(", ")}`);
  process.exit(1);
}
