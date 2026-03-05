// ──────────────────────────────────────────────────────────
// POST /api/upload-photo
//
// Accepts multipart/form-data with a single image file.
// Validates type (JPEG/PNG/WebP), resizes to max 1024x1024,
// saves to public/uploads/photos/ with a UUID filename.
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DIMENSION = 1024;
const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "photos");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("photo");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No photo file provided." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Resize to max 1024x1024, preserving aspect ratio
    const resized = await sharp(buffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const photoId = uuidv4();
    const filename = `${photoId}.jpg`;

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    const filePath = join(UPLOAD_DIR, filename);
    await writeFile(filePath, resized);

    const url = `/uploads/photos/${filename}`;

    return NextResponse.json({ url, photoId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
