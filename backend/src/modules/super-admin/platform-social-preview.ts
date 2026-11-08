import sharp from "sharp";

/** A public share card, using only the platform logo saved by the Super Admin. */
export async function renderPlatformSocialPreview(logo: Buffer | null): Promise<Buffer> {
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#0b1f2a"/>
    <rect width="1200" height="8" fill="#10b981"/>
    <circle cx="1160" cy="610" r="210" fill="#12343e"/>
    <rect x="80" y="155" width="280" height="280" rx="32" fill="white"/>
    ${logo ? "" : '<text x="220" y="323" text-anchor="middle" font-family="sans-serif" font-size="70" font-weight="700" fill="#059669">EMS</text>'}
    <g font-family="DejaVu Sans, Segoe UI, sans-serif">
      <text x="80" y="87" font-size="22" fill="#a7f3d0">A product of Hikmah IT</text>
      <text x="410" y="228" font-size="78" font-weight="700" fill="white">EMS</text>
      <text x="414" y="278" font-size="28" fill="#5ee4b1">Education Management System</text>
      <text x="414" y="345" font-size="32" font-weight="700" fill="white">Run your institution.</text>
      <text x="414" y="390" font-size="32" font-weight="700" fill="white">Simplify every day.</text>
      <text x="414" y="441" font-size="20" fill="#b3c9d1">Madrasa / School / College / Kindergarten</text>
      <text x="80" y="545" font-size="22" fill="#a7f3d0">Admission  /  Attendance  /  Results  /  Accounts</text>
    </g>
  </svg>`);

  if (!logo) return sharp(background).png().toBuffer();
  const mark = await sharp(logo, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: 232, height: 232, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp(background).composite([{ input: mark, left: 104, top: 179 }]).png().toBuffer();
}
