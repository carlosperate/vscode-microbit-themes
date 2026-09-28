// VS Code Web on showcase/workspace with the themes loaded from source, for a
// browser or the Playwright MCP server to open. A fresh browser profile starts on
// Pixel Light: the development host applies the extension's first light theme.
import { open } from "@vscode/test-web";
import { join } from "node:path";

const PORT = 3000;
const root = join(import.meta.dirname, "..");

// VS Code Web opens one file from the URL at most, the `openFile` payload.
const payload = JSON.stringify([["openFile", "vscode-test-web://mount/main.py"]]);

async function main() {
  await open({
    browserType: "none",
    quality: "stable",
    port: PORT,
    extensionDevelopmentPath: root,
    folderPath: join(root, "showcase", "workspace"),
  });
  console.log(`\nOpen http://localhost:${PORT}/?payload=${encodeURIComponent(payload)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
