/**
 * Product image uploads.
 * - Only JPEG, PNG and WebP, up to 5 MB.
 * - The real type is read from the file's first bytes (magic numbers); the
 *   name, extension and browser-sent MIME type are ignored.
 * - The image is decoded and re-encoded by sharp (so anything that is not a real
 *   image fails), auto-rotated, cropped square and written as WebP in two sizes.
 *   sharp drops all metadata (EXIF, GPS, ICC comments) unless asked to keep it.
 * - Files go to public/uploads/products/ under random names and are served by
 *   the /media/products/[file] route (next start only serves public/ files that
 *   existed at build time).
 */
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_SIZES = { large: 1200, thumb: 600 } as const;
/** Generated file names only: random hex + size. */
export const MEDIA_FILE_RE = /^p-[a-f0-9]{24}-(?:1200|600)\.webp$/;
export const MEDIA_PREFIX = "/media/products/";

export type DetectedType = "jpeg" | "png" | "webp";

export function detectImageType(bytes: Uint8Array): DetectedType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && // R
    b[1] === 0x49 && // I
    b[2] === 0x46 && // F
    b[3] === 0x46 && // F
    b[8] === 0x57 && // W
    b[9] === 0x45 && // E
    b[10] === 0x42 && // B
    b[11] === 0x50 // P
  )
    return "webp";
  return null;
}

export function uploadsDir(): string {
  return resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.UPLOADS_DIR ?? join("public", "uploads", "products"),
  );
}

export type ImageCheck = { ok: true; type: DetectedType } | { ok: false; error: string };

export function checkUpload(file: { size: number }, head: Uint8Array): ImageCheck {
  if (file.size === 0) return { ok: false, error: "Choose an image file." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Images must be 5 MB or smaller." };
  const type = detectImageType(head);
  if (!type) return { ok: false, error: "Only JPEG, PNG or WebP images are accepted." };
  return { ok: true, type };
}

export type StoredImage = { imagePath: string; thumbPath: string };

/** Re-encodes and stores an upload. Throws if the bytes are not a decodable image. */
export async function processAndStoreImage(bytes: Buffer): Promise<StoredImage> {
  const id = randomBytes(12).toString("hex");
  const dir = uploadsDir();
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const names: string[] = [];
  try {
    for (const size of [IMAGE_SIZES.large, IMAGE_SIZES.thumb]) {
      const out = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" })
        .rotate() // apply EXIF orientation before the metadata is dropped
        .resize(size, size, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer();
      const name = `p-${id}-${size}.webp`;
      await writeFile(join(/*turbopackIgnore: true*/ dir, name), out);
      names.push(name);
    }
  } catch (err) {
    await Promise.all(names.map((n) => unlink(join(dir, n)).catch(() => undefined)));
    throw err;
  }
  return { imagePath: MEDIA_PREFIX + names[0], thumbPath: MEDIA_PREFIX + names[1] };
}

/** Removes stored files for an uploaded image (ignores SVG illustrations). */
export async function deleteStoredImage(paths: Array<string | null | undefined>) {
  for (const p of paths) {
    if (!p || !p.startsWith(MEDIA_PREFIX)) continue;
    const name = p.slice(MEDIA_PREFIX.length);
    if (!MEDIA_FILE_RE.test(name)) continue;
    await unlink(join(uploadsDir(), name)).catch(() => undefined);
  }
}
