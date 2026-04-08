import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const iconsDir = path.join(repoRoot, "src-tauri", "icons");
const publicDir = path.join(repoRoot, "public");
const canonical32 = path.join(iconsDir, "32x32.png");
const canonical128 = path.join(iconsDir, "128x128.png");
const canonical256 = path.join(iconsDir, "128x128@2x.png");
const canonicalIco = path.join(iconsDir, "icon.ico");

for (const iconPath of [canonical32, canonical128, canonical256, canonicalIco]) {
  if (!fs.existsSync(iconPath)) {
    console.error(`Missing canonical Tauri icon: ${iconPath}`);
    process.exit(1);
  }
}

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

for (const [source, target] of [
  [canonical32, path.join(publicDir, "icon-light-32x32.png")],
  [canonical32, path.join(publicDir, "icon-dark-32x32.png")],
  [canonical256, path.join(publicDir, "iconHD.png")],
  [canonical256, path.join(publicDir, "apple-icon.png")],
]) {
  fs.copyFileSync(source, target);
}

console.log("Synced canonical Tauri icons into public assets");
