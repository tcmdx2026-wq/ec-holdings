/**
 * Server function for uploading images to Cloudinary.
 * Stores the image URL in Neon (not base64).
 */
import { createServerFn } from "@tanstack/react-start";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY = process.env.CLOUDINARY_API_KEY ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

function isConfigured(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

/**
 * Upload a base64 image to Cloudinary and return the URL.
 * Hỗ trợ: ảnh (image/*), video (video/*), file văn phòng (raw — PDF/Word/Excel...).
 * Falls back to returning the base64 string if Cloudinary is not configured.
 */
export const uploadImage = createServerFn({ method: "POST" })
  .validator(
    (data: {
      base64: string;
      folder?: string;
      fileName?: string; // Tên gốc — dùng làm public_id cho file raw
    }) => data,
  )
  .handler(async ({ data }) => {
    // If Cloudinary not configured, throw error — no base64 fallback
    if (!isConfigured()) {
      throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.");
    }

    // Dynamic import to avoid issues if cloudinary is not installed
    const { v2: cloudinary } = await import("cloudinary");

    cloudinary.config({
      cloud_name: CLOUD_NAME,
      api_key: API_KEY,
      api_secret: API_SECRET,
    });

    // Determine resource type from base64 header:
    // video/* → video, application/* (pdf, word, excel...) → raw, còn lại → image
    const isVideo = data.base64.includes("video/");
    const isRaw = data.base64.includes("application/");
    const resourceType = isVideo ? "video" : isRaw ? "raw" : "image";

    // Upload using upload_stream with 30s timeout to avoid hanging on slow networks
    const result = await Promise.race([
      new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: data.folder || "giong-vn",
            resource_type: resourceType,
            // File raw (PDF/Word/Excel) KHÔNG dùng transformation ảnh — sẽ lỗi upload
            ...(resourceType === "image"
              ? {
                  transformation: [
                    { width: 1200, height: 1200, crop: "limit" }, // Max 1200px
                    { quality: "auto" }, // Auto compress
                  ],
                }
              : {}),
            // Giữ tên file gốc cho raw để người dùng tải về đúng tên
            ...(resourceType === "raw" && data.fileName
              ? { public_id: data.fileName.replace(/\.[^.]+$/, "") }
              : {}),
          },
          (error, result) => {
            if (error) reject(error);
            else
              resolve({
                secure_url: result!.secure_url,
                public_id: result!.public_id,
              });
          },
        );

        // Send the base64 data
        stream.end(Buffer.from(data.base64.split(",")[1], "base64"));
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("upload timeout (30s)")), 30000)),
    ]);

    return { url: result.secure_url, provider: "cloudinary" as const };
  });

/**
 * Delete an image from Cloudinary by URL.
 */
export const deleteImage = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    if (!isConfigured()) return { deleted: false };

    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloud_name: CLOUD_NAME,
      api_key: API_KEY,
      api_secret: API_SECRET,
    });

    // Extract public_id from URL
    // URL format: https://res.cloudinary.com/CLOUD/image/upload/v123/folder/file.jpg
    const parts = data.url.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return { deleted: false };

    const publicId = parts
      .slice(uploadIdx + 1)
      .filter((p) => !p.startsWith("v"))
      .join("/")
      .replace(/\.[^.]+$/, ""); // Remove extension

    try {
      await cloudinary.uploader.destroy(publicId);
      return { deleted: true };
    } catch {
      return { deleted: false };
    }
  });

/**
 * GĐ 228f: ký chữ ký upload THẲNG lên Cloudinary từ trình duyệt (signed upload).
 * Dùng cho VIDEO check-in — file 30s ~5-6MB vượt giới hạn body 4.5MB của Vercel
 * serverless khi gửi base64 qua server function (video không bao giờ lưu được).
 * Server chỉ trả chữ ký (nhỏ); trình duyệt POST thẳng file lên Cloudinary.
 */
export const getCloudinarySignature = createServerFn({ method: "POST" })
  .validator((data: { folder?: string }) => data)
  .handler(async ({ data }) => {
    if (!isConfigured()) {
      throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.");
    }
    const crypto = await import("node:crypto");
    const timestamp = Math.round(Date.now() / 1000);
    const folder = data?.folder || "giong-vn/check-in";
    // Chữ ký SHA-1 của params + api_secret theo chuẩn Cloudinary signed upload
    const signature = crypto
      .createHash("sha1")
      .update(`folder=${folder}&timestamp=${timestamp}${API_SECRET}`)
      .digest("hex");
    return { signature, timestamp, folder, cloudName: CLOUD_NAME, apiKey: API_KEY };
  });
