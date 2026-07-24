import sharp from "sharp";

export const encodeWebpUnderLimit = async (
  sourceBuffer,
  {
    width,
    height,
    maxBytes,
    initialQuality = 82,
    minQuality = 50,
    fit = "cover",
    position = "entropy",
    withoutEnlargement = false,
  },
) => {
  const safeMaxBytes = Math.max(32 * 1024, Number(maxBytes || 0));
  let targetWidth = Math.max(128, Math.round(Number(width || 1200)));
  let targetHeight = Math.max(128, Math.round(Number(height || 675)));
  let smallestBuffer = null;

  for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
    for (
      let quality = Math.min(92, Math.max(minQuality, initialQuality));
      quality >= minQuality;
      quality -= 8
    ) {
      const output = await sharp(sourceBuffer)
        .rotate()
        .resize(targetWidth, targetHeight, {
          fit,
          position,
          withoutEnlargement,
        })
        .webp({ quality, effort: 6 })
        .toBuffer();

      if (!smallestBuffer || output.length < smallestBuffer.length) {
        smallestBuffer = output;
      }
      if (output.length <= safeMaxBytes) return output;
    }

    targetWidth = Math.max(128, Math.round(targetWidth * 0.82));
    targetHeight = Math.max(128, Math.round(targetHeight * 0.82));
  }

  if (!smallestBuffer || smallestBuffer.length > safeMaxBytes) {
    throw new Error("Image could not be compressed below the storage limit");
  }
  return smallestBuffer;
};
