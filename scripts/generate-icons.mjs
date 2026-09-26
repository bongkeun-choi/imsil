import sharp from "sharp";
import fs from "fs";
import path from "path";

// Function to pack PNG buffers into a multi-resolution ICO file
function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(count, 4); // count

  const dirEntries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    const w = item.width >= 256 ? 0 : item.width;
    const h = item.height >= 256 ? 0 : item.height;

    entry.writeUInt8(w, 0); // width
    entry.writeUInt8(h, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(item.buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset

    dirEntries.push(entry);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map((b) => b.buffer)]);
}

async function generateAllIcons() {
  const sourcePath = "배추아이콘.png";
  if (!fs.existsSync(sourcePath)) {
    throw new Error("배추아이콘.png not found!");
  }

  // Ensure directories exist
  fs.mkdirSync("public/icons", { recursive: true });
  fs.mkdirSync("src/app", { recursive: true });

  console.log("Generating icons from 배추아이콘.png...");

  // 1. Generate PNGs for ICO (16, 32, 48, 64, 128, 256)
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  for (const size of icoSizes) {
    const buf = await sharp(sourcePath)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push({ width: size, height: size, buffer: buf });
  }

  const icoBuffer = createIco(pngBuffers);
  fs.writeFileSync("public/favicon.ico", icoBuffer);
  fs.writeFileSync("src/app/favicon.ico", icoBuffer);
  fs.writeFileSync("public/app-icon.ico", icoBuffer);
  console.log("Saved favicon.ico and app-icon.ico (multi-res: 16, 32, 48, 64, 128, 256)");

  // 2. Generate standard PWA and Apple Touch icons
  // 192x192
  await sharp(sourcePath)
    .resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile("public/icons/icon-192.png");

  // 512x512
  await sharp(sourcePath)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile("public/icons/icon-512.png");

  // Maskable 192 & 512 (with 10% safe zone padding and soft white background)
  const pad192 = Math.round(192 * 0.8);
  const inner192 = await sharp(sourcePath)
    .resize(pad192, pad192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: inner192, gravity: "center" }])
    .png()
    .toFile("public/icons/icon-maskable-192.png");

  const pad512 = Math.round(512 * 0.8);
  const inner512 = await sharp(sourcePath)
    .resize(pad512, pad512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: inner512, gravity: "center" }])
    .png()
    .toFile("public/icons/icon-maskable-512.png");

  // Apple Touch Icon (180x180)
  await sharp(sourcePath)
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile("public/apple-touch-icon.png");

  // src/app/icon.png and src/app/apple-icon.png (Next.js App router special convention)
  await sharp(sourcePath)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile("src/app/icon.png");

  await sharp(sourcePath)
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile("src/app/apple-icon.png");

  // Also public/icon.png
  await sharp(sourcePath)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile("public/icon.png");

  console.log("All icons generated successfully!");
}

generateAllIcons().catch(console.error);
