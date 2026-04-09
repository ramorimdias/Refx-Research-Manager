import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const iconsDir = path.join(repoRoot, "src-tauri", "icons");
const publicDir = path.join(repoRoot, "public");
const sourceIcon = path.join(iconsDir, "app-icon.png");
const canonical32 = path.join(iconsDir, "32x32.png");
const canonical128 = path.join(iconsDir, "128x128.png");
const canonical256 = path.join(iconsDir, "128x128@2x.png");
const canonicalIcns = path.join(iconsDir, "icon.icns");
const canonicalIco = path.join(iconsDir, "icon.ico");
const canonicalPng = path.join(iconsDir, "icon.png");

if (!fs.existsSync(sourceIcon)) {
  console.error(`Missing source icon: ${sourceIcon}`);
  process.exit(1);
}

const tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "refx-tauri-icons-"));
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const tauriIcon = spawnSync(pnpmCommand, ["exec", "tauri", "icon", sourceIcon, "-o", tempOutputDir], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
});

if ((tauriIcon.status ?? 1) !== 0) {
  process.exit(tauriIcon.status ?? 1);
}

const generatedFiles = new Map([
  [path.join(tempOutputDir, "32x32.png"), canonical32],
  [path.join(tempOutputDir, "128x128.png"), canonical128],
  [path.join(tempOutputDir, "128x128@2x.png"), canonical256],
  [path.join(tempOutputDir, "icon.icns"), canonicalIcns],
  [path.join(tempOutputDir, "icon.ico"), canonicalIco],
  [path.join(tempOutputDir, "icon.png"), canonicalPng],
]);

for (const iconPath of generatedFiles.keys()) {
  if (!fs.existsSync(iconPath)) {
    console.error(`Missing generated icon: ${iconPath}`);
    process.exit(1);
  }
}

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

for (const [source, target] of generatedFiles.entries()) {
  fs.copyFileSync(source, target);
}

for (const [source, target] of [
  [canonical32, path.join(publicDir, "icon-light-32x32.png")],
  [canonical32, path.join(publicDir, "icon-dark-32x32.png")],
  [canonicalPng, path.join(publicDir, "iconHD.png")],
  [canonicalPng, path.join(publicDir, "apple-icon.png")],
]) {
  fs.copyFileSync(source, target);
}

for (const stalePath of [
  path.join(iconsDir, "64x64.png"),
  path.join(iconsDir, "StoreLogo.png"),
  path.join(iconsDir, "Square30x30Logo.png"),
  path.join(iconsDir, "Square44x44Logo.png"),
  path.join(iconsDir, "Square71x71Logo.png"),
  path.join(iconsDir, "Square89x89Logo.png"),
  path.join(iconsDir, "Square107x107Logo.png"),
  path.join(iconsDir, "Square142x142Logo.png"),
  path.join(iconsDir, "Square150x150Logo.png"),
  path.join(iconsDir, "Square284x284Logo.png"),
  path.join(iconsDir, "Square310x310Logo.png"),
  path.join(iconsDir, "android"),
  path.join(iconsDir, "ios"),
]) {
  if (fs.existsSync(stalePath)) {
    fs.rmSync(stalePath, { recursive: true, force: true });
  }
}

fs.rmSync(tempOutputDir, { recursive: true, force: true });

console.log("Generated Tauri icons from a single source PNG and synced public assets");
