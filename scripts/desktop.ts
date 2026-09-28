// Desktop VS Code on showcase/workspace with the themes loaded from source, Theme
// Builder installed and every sample file open, on a profile wiped every launch.
// `--cdp-port=<n>` lets Playwright attach over the Chrome DevTools Protocol.
import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } from "@vscode/test-electron";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Proprietary licence, so it is installed from the gallery and never vendored here.
const THEME_BUILDER = "gabbatron.vscode-theme-builder";

const root = join(import.meta.dirname, "..");
const cache = join(root, ".vscode-test");
const workspace = join(root, "showcase", "workspace");
// In the repo, `<profile>/1.xx-main.sock` would pass macOS's 103-byte socket path limit.
const profile = join(tmpdir(), "microbit-themes-profile");
// The manifest's first theme, the one VS Code Web starts on too.
const theme = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).contributes.themes[0].label;

rmSync(profile, { recursive: true, force: true });
mkdirSync(join(profile, "User"), { recursive: true });
// The Copilot modal swallows keystrokes, and it ships as a builtin that no flag disables.
const settings = {
  "chat.disableAIFeatures": true,
  "workbench.colorTheme": theme,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
};
writeFileSync(join(profile, "User", "settings.json"), JSON.stringify(settings, null, 2) + "\n");

// Opened as editors; VS Code focuses the first, so main.py leads.
const samples = readdirSync(workspace, { recursive: true, encoding: "utf8" })
  .filter((f) => /\.\w+$/.test(f) && !f.startsWith(".vscode") && f !== "main.py")
  .sort();
const files = ["main.py", ...samples].map((f) => join(workspace, f));

// Inherited VSCODE_* vars stop webviews registering their service worker.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("VSCODE_")));

async function main() {
  const executable = await downloadAndUnzipVSCode({ version: "stable", cachePath: cache });
  const extensionsDir = join(cache, "extensions");
  const installed = existsSync(extensionsDir) && readdirSync(extensionsDir).some((d) => d.startsWith(`${THEME_BUILDER}-`));
  if (!installed) {
    const cli = resolveCliPathFromVSCodeExecutablePath(executable);
    const run = spawnSync(cli, ["--install-extension", THEME_BUILDER, `--extensions-dir=${extensionsDir}`], { stdio: "inherit", env });
    if (run.status !== 0) throw new Error(`could not install ${THEME_BUILDER}`);
  }

  const cdpPort = process.argv.find((a) => a.startsWith("--cdp-port="))?.split("=")[1];
  spawn(
    executable,
    [
      // With exactly one development path VS Code applies that extension's first theme and
      // ignores `workbench.colorTheme`, so the same path is passed twice.
      `--extensionDevelopmentPath=${root}`,
      `--extensionDevelopmentPath=${root}`,
      `--user-data-dir=${profile}`,
      `--extensions-dir=${extensionsDir}`,
      "--skip-welcome",
      "--skip-release-notes",
      "--disable-workspace-trust",
      ...(cdpPort ? [`--remote-debugging-port=${cdpPort}`] : []),
      workspace,
      ...files,
    ],
    { stdio: "inherit", env },
  ).on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
