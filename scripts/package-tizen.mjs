/**
 * Tizen Package Generator (.wgt)
 *
 * Copies config.xml and application icon to dist/ and creates the Rediplays.wgt package
 * ready to install on Samsung Tizen Smart TVs via Tizen Studio CLI, SDB, or USB developer mode.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const CONFIG_XML = join(ROOT, "config.xml");
const ICON = join(ROOT, "app-icon.png");
const OUTPUT_WGT = join(ROOT, "Rediplays-tizen.wgt");

// CRC32 calculation fallback if node:zlib crc32 isn't available
function calculateCrc32(buf) {
  if (typeof crc32 === "function") {
    return crc32(buf);
  }
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

/**
 * Creates a standard ZIP (WGT) file from files list without third-party dependencies.
 */
function createZip(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name.replace(/\\/g, "/"), "utf8");
    const content = file.data;
    const uncompressedSize = content.length;
    const fileCrc = calculateCrc32(content);

    // Deflate compression
    const compressed = deflateRawSync(content);
    const compressedSize = compressed.length;

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed to extract
    localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
    localHeader.writeUInt16LE(8, 8);          // Compression method (8 = deflate)
    localHeader.writeUInt16LE(0, 10);         // Last mod time
    localHeader.writeUInt16LE(0, 12);         // Last mod date
    localHeader.writeUInt32LE(fileCrc, 14);   // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18);   // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26);// File name length
    localHeader.writeUInt16LE(0, 28);                // Extra field length
    nameBuffer.copy(localHeader, 30);

    localHeaders.push(localHeader, compressed);

    // Central directory header (46 bytes + name)
    const centralHeader = Buffer.alloc(46 + nameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central header signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by
    centralHeader.writeUInt16LE(20, 6);         // Version needed to extract
    centralHeader.writeUInt16LE(0, 8);          // General purpose bit flag
    centralHeader.writeUInt16LE(8, 10);         // Compression method (deflate)
    centralHeader.writeUInt16LE(0, 12);         // Last mod time
    centralHeader.writeUInt16LE(0, 14);         // Last mod date
    centralHeader.writeUInt32LE(fileCrc, 16);   // CRC-32
    centralHeader.writeUInt32LE(compressedSize, 20);   // Compressed size
    centralHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
    centralHeader.writeUInt16LE(nameBuffer.length, 28);// File name length
    centralHeader.writeUInt16LE(0, 30);                // Extra field length
    centralHeader.writeUInt16LE(0, 32);                // File comment length
    centralHeader.writeUInt16LE(0, 34);                // Disk number start
    centralHeader.writeUInt16LE(0, 36);                // Internal file attributes
    centralHeader.writeUInt32LE(0, 38);                // External file attributes
    centralHeader.writeUInt32LE(offset, 42);           // Relative offset of local header
    nameBuffer.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + compressed.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((sum, b) => sum + b.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // EOCD signature
  eocd.writeUInt16LE(0, 4);                // Number of this disk
  eocd.writeUInt16LE(0, 6);                // Disk where central dir starts
  eocd.writeUInt16LE(files.length, 8);     // Number of central dir records on this disk
  eocd.writeUInt16LE(files.length, 10);    // Total number of central dir records
  eocd.writeUInt32LE(centralDirSize, 12);  // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);// Offset of central directory
  eocd.writeUInt16LE(0, 20);               // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function collectFiles(dir) {
  const result = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      result.push(...collectFiles(fullPath));
    } else {
      const rel = relative(DIST, fullPath).replace(/\\/g, "/");
      result.push({ name: rel, data: readFileSync(fullPath) });
    }
  }
  return result;
}

async function packageTizen() {
  console.log("Preparing Tizen TV package...");

  if (!existsSync(DIST)) {
    console.error("Error: dist/ directory not found. Run 'npm run build' first.");
    process.exit(1);
  }

  // Ensure config.xml is in dist/
  if (existsSync(CONFIG_XML)) {
    copyFileSync(CONFIG_XML, join(DIST, "config.xml"));
    console.log("  Copied config.xml to dist/");
  } else {
    console.error("Error: config.xml not found in root.");
    process.exit(1);
  }

  // Ensure icon is in dist/
  if (existsSync(ICON)) {
    copyFileSync(ICON, join(DIST, "app-icon.png"));
    copyFileSync(ICON, join(DIST, "icon.png"));
    console.log("  Copied app-icon.png to dist/");
  }

  const files = collectFiles(DIST);
  console.log(`  Packaging ${files.length} files into WGT...`);

  const zipBuffer = createZip(files);
  writeFileSync(OUTPUT_WGT, zipBuffer);

  console.log(`\n Successfully generated Tizen package: ${OUTPUT_WGT}`);
  console.log(` Package size: ${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
}

packageTizen().catch((err) => {
  console.error("Failed to package Tizen app:", err);
  process.exit(1);
});
