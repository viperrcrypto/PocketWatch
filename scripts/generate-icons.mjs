import sharp from "sharp";
import { writeFileSync } from "fs";
import { join } from "path";

const IMG_DIR = join(import.meta.dirname, "..", "public", "img");

// Pocket watch icon SVG with rounded-rect app-icon background
function makeIconSvg(size) {
  const r = Math.round(size * 0.22); // corner radius ~22%
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="${size}" x2="${size}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <!-- Rounded background -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <!-- Watch group centered -->
  <g transform="translate(${size / 2}, ${size * 0.52}) scale(${size / 64})">
    <!-- Chain/ring at top -->
    <line x1="0" y1="-24" x2="0" y2="-20" stroke="white" stroke-width="2.2" stroke-linecap="round" opacity="0.7"/>
    <circle cx="0" cy="-24.5" r="1.8" fill="none" stroke="white" stroke-width="1.2" opacity="0.7"/>
    <!-- Watch body -->
    <circle cx="0" cy="0" r="18" fill="white" opacity="0.15"/>
    <circle cx="0" cy="0" r="17" fill="none" stroke="white" stroke-width="1" opacity="0.3"/>
    <!-- Inner face ring -->
    <circle cx="0" cy="0" r="14" fill="none" stroke="white" stroke-width="0.8" opacity="0.2"/>
    <!-- Hour hand (pointing to 12) -->
    <line x1="0" y1="0" x2="0" y2="-10" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <!-- Minute hand (pointing to 2) -->
    <line x1="0" y1="0" x2="7.5" y2="-7.5" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
    <!-- Center dot -->
    <circle cx="0" cy="0" r="2" fill="white"/>
    <!-- Hour markers -->
    <circle cx="0" cy="-14" r="1.2" fill="white" opacity="0.5"/>
    <circle cx="14" cy="0" r="1.2" fill="white" opacity="0.5"/>
    <circle cx="0" cy="14" r="1.2" fill="white" opacity="0.5"/>
    <circle cx="-14" cy="0" r="1.2" fill="white" opacity="0.5"/>
    <!-- Diagonal markers -->
    <circle cx="9.9" cy="-9.9" r="0.9" fill="white" opacity="0.35"/>
    <circle cx="9.9" cy="9.9" r="0.9" fill="white" opacity="0.35"/>
    <circle cx="-9.9" cy="9.9" r="0.9" fill="white" opacity="0.35"/>
    <circle cx="-9.9" cy="-9.9" r="0.9" fill="white" opacity="0.35"/>
  </g>
</svg>`;
}

// Circle version for favicon/apple-icon (no rounded rect, just circle)
function makeCircleSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="${size}" x2="${size}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#bg)"/>
  <g transform="translate(${size / 2}, ${size * 0.52}) scale(${size / 64})">
    <line x1="0" y1="-22" x2="0" y2="-18" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <circle cx="0" cy="-22.5" r="1.5" fill="none" stroke="white" stroke-width="1" opacity="0.7"/>
    <circle cx="0" cy="0" r="16" fill="white" opacity="0.15"/>
    <circle cx="0" cy="0" r="15" fill="none" stroke="white" stroke-width="0.8" opacity="0.3"/>
    <circle cx="0" cy="0" r="12.5" fill="none" stroke="white" stroke-width="0.6" opacity="0.2"/>
    <line x1="0" y1="0" x2="0" y2="-9" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
    <line x1="0" y1="0" x2="6.5" y2="-6.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <circle cx="0" cy="0" r="1.8" fill="white"/>
    <circle cx="0" cy="-12.5" r="1" fill="white" opacity="0.5"/>
    <circle cx="12.5" cy="0" r="1" fill="white" opacity="0.5"/>
    <circle cx="0" cy="12.5" r="1" fill="white" opacity="0.5"/>
    <circle cx="-12.5" cy="0" r="1" fill="white" opacity="0.5"/>
  </g>
</svg>`;
}

// Maskable icon (extra padding for safe zone)
function makeMaskableSvg(size) {
  const padding = size * 0.1;
  const inner = size - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="${size}" x2="${size}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g transform="translate(${size / 2}, ${size * 0.52}) scale(${inner / 64})">
    <line x1="0" y1="-22" x2="0" y2="-18" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <circle cx="0" cy="-22.5" r="1.5" fill="none" stroke="white" stroke-width="1" opacity="0.7"/>
    <circle cx="0" cy="0" r="16" fill="white" opacity="0.15"/>
    <circle cx="0" cy="0" r="15" fill="none" stroke="white" stroke-width="0.8" opacity="0.3"/>
    <circle cx="0" cy="0" r="12.5" fill="none" stroke="white" stroke-width="0.6" opacity="0.2"/>
    <line x1="0" y1="0" x2="0" y2="-9" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
    <line x1="0" y1="0" x2="6.5" y2="-6.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <circle cx="0" cy="0" r="1.8" fill="white"/>
    <circle cx="0" cy="-12.5" r="1" fill="white" opacity="0.5"/>
    <circle cx="12.5" cy="0" r="1" fill="white" opacity="0.5"/>
    <circle cx="0" cy="12.5" r="1" fill="white" opacity="0.5"/>
    <circle cx="-12.5" cy="0" r="1" fill="white" opacity="0.5"/>
  </g>
</svg>`;
}

async function generate(svg, filename, size) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  const path = join(IMG_DIR, filename);
  writeFileSync(path, buf);
  console.log(`  ✓ ${filename} (${size}x${size})`);
}

async function main() {
  console.log("Generating PocketWatch icons...\n");

  // App icons (rounded rect)
  await generate(makeIconSvg(512), "logo.png", 512);
  await generate(makeIconSvg(512), "logo-circle.png", 512);
  await generate(makeIconSvg(512), "card_logo.png", 512);

  // PWA icons
  await generate(makeIconSvg(192), "pwa-icon-192.png", 192);
  await generate(makeIconSvg(512), "pwa-icon-512.png", 512);

  // Maskable (full bleed, no rounded corners)
  await generate(makeMaskableSvg(512), "pwa-maskable-512.png", 512);

  // Apple icon (180x180)
  await generate(makeIconSvg(180), "apple-icon.png", 180);

  // Favicon
  await generate(makeCircleSvg(32), "favicon-32.png", 32);

  // OG image (1200x630 banner)
  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="630" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="50%" stop-color="#312e81"/>
        <stop offset="100%" stop-color="#1e3a5f"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#22d3ee"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <!-- Subtle grid pattern -->
    <g opacity="0.04" stroke="white" stroke-width="0.5">
      ${Array.from({length: 20}, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="630"/>`).join("")}
      ${Array.from({length: 11}, (_, i) => `<line x1="0" y1="${i * 60}" x2="1200" y2="${i * 60}"/>`).join("")}
    </g>
    <!-- Watch icon -->
    <g transform="translate(350, 315) scale(3.5)">
      <line x1="0" y1="-24" x2="0" y2="-20" stroke="#22d3ee" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
      <circle cx="0" cy="-24.5" r="1.8" fill="none" stroke="#22d3ee" stroke-width="1.2" opacity="0.8"/>
      <circle cx="0" cy="0" r="18" fill="white" opacity="0.1"/>
      <circle cx="0" cy="0" r="17" fill="none" stroke="white" stroke-width="1" opacity="0.25"/>
      <circle cx="0" cy="0" r="14" fill="none" stroke="white" stroke-width="0.8" opacity="0.15"/>
      <line x1="0" y1="0" x2="0" y2="-10" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <line x1="0" y1="0" x2="7.5" y2="-7.5" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="0" cy="0" r="2" fill="white"/>
      <circle cx="0" cy="-14" r="1.2" fill="white" opacity="0.4"/>
      <circle cx="14" cy="0" r="1.2" fill="white" opacity="0.4"/>
      <circle cx="0" cy="14" r="1.2" fill="white" opacity="0.4"/>
      <circle cx="-14" cy="0" r="1.2" fill="white" opacity="0.4"/>
    </g>
    <!-- Text -->
    <text x="520" y="270" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="white">PocketWatch</text>
    <text x="520" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="white" opacity="0.6">See everything you own. In one place.</text>
    <!-- Accent line -->
    <rect x="520" y="345" width="120" height="3" rx="1.5" fill="url(#accent)" opacity="0.8"/>
    <!-- Feature pills -->
    <g font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="white">
      <rect x="520" y="370" width="120" height="28" rx="14" fill="white" opacity="0.08"/>
      <text x="555" y="389" opacity="0.5">Banking</text>
      <rect x="650" y="370" width="140" height="28" rx="14" fill="white" opacity="0.08"/>
      <text x="678" y="389" opacity="0.5">Investments</text>
      <rect x="800" y="370" width="100" height="28" rx="14" fill="white" opacity="0.08"/>
      <text x="823" y="389" opacity="0.5">Cards</text>
      <rect x="910" y="370" width="150" height="28" rx="14" fill="white" opacity="0.08"/>
      <text x="934" y="389" opacity="0.5">Digital Assets</text>
    </g>
  </svg>`;

  const ogBuf = await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toBuffer();
  writeFileSync(join(IMG_DIR, "og-banner.jpg"), await sharp(ogBuf).jpeg({ quality: 90 }).toBuffer());
  writeFileSync(join(IMG_DIR, "og-image.png"), ogBuf);
  console.log("  ✓ og-banner.jpg (1200x630)");
  console.log("  ✓ og-image.png (1200x630)");

  console.log("\nDone!");
}

main().catch(console.error);
