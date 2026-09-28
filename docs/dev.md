# Developer Notes

## Quick start

```sh
npm install
npm run build
```

Press `F5` in VS Code to launch the Extension Development Host with all six themes loaded.
Then `CMD+K` + `CMD+T` to open the theme picker and try them out.

## Adding or changing colours

1. Edit the relevant `src/themes/*.ts` files.
2. When adding a new colour key, add it to **all six** theme files — key parity across themes is a hard invariant.
3. Run `npm run build`.
4. Validate the generated JSON (it parses, and all six themes share one key set) and the manifest:
   ```sh
   npm run validate
   npx @vscode/vsce ls
   ```
5. Look at the change, before and after, in one of the test sessions below.

## Test sessions

Both open `showcase/workspace/`, sample files with a loaded themes loaded by
default.

```sh
npm run desktop   # desktop VS Code, fresh profile each launch, with Theme Builder extension
npm run serve     # VS Code Web on http://localhost:3000
```

The desktop session installs [Theme Builder](https://open-vsx.org/extension/gabbatron/vscode-theme-builder).
Run the `Theme Builder: Open` command and pick an area to see the mockup on the right.

`npm run desktop -- --cdp-port=9223` also lets Playwright drive the window.

### Before and after screenshots

With the desktop session running on `--cdp-port=9223`, capture every Theme Builder mockup for each
theme, change the colours, rebuild, capture again, and compare:

```sh
npm run mockups:capture -- before          # all six themes, or name some: -- before "micro:bit Spark Dark"
npm run build                              # after editing src/themes/, then Developer: Reload Window
npm run mockups:capture -- after
npm run mockups:compare -- before after    # writes .screenshots/before-vs-after/index.html
```

The compare page shows only the mockups that changed, cropped to the rows that changed.

## Build Package

```sh
npm run build
npx @vscode/vsce ls
npx @vscode/vsce package
```

To install it locally for testing outside the dev host:

```sh
code --install-extension microbit-themes-<version>.vsix
```

## Marketplace screenshots

The six per-theme screenshots and the composite preview live in `docs/screenshots/`.

1. Launch the Extension Development Host (**F5**) and pick a theme (`CMD+K CMD+T`).
2. Arrange the window how you want it to look.
3. Save all screenshots as `docs/screenshots/microbit-{family}-{mode}.png`
4. Generate the composite:
   ```sh
   npm run screenshots:compose
   ```
   This writes:
   - `docs/screenshots/preview.png` — full-resolution 3×2 grid (Pixel / Spark / Halo across, Light / Dark down), transparent background.
   - `docs/screenshots/preview-small.png` — 1500px-wide downscale, suitable for the README hero / marketplace image.

`docs/**` is excluded from the published `.vsix` via `.vscodeignore`, so these images live in the repo and are referenced from the marketplace README via raw GitHub URLs.

## Release flow

1. Bump `version` in `package.json` (semver).
2. Update `CHANGELOG.md` and ensure it has all changes documented.
3. Commit and push.
4. Create a GitHub release for tag `vX.Y.Z`.
5. The `publish.yml` workflow publishes the extension to the VS Code Marketplaceand and Open VSX Registry.

For a dry run without publishing: **Actions → Publish → Run workflow** with `dry_run: true`.
