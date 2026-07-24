const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to compress image"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

export const compressImageFileToLimit = async ({
  file,
  maxBytes,
  maxWidth = 1600,
  maxHeight = 1600,
  initialQuality = 0.82,
  minQuality = 0.48,
  baseName = "optimized-image",
}) => {
  if (!(file instanceof File)) throw new Error("Invalid image file");
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    throw new Error("Unsupported image type");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Unable to load image"));
      nextImage.src = objectUrl;
    });
    const sourceWidth = Math.max(1, image.naturalWidth || image.width);
    const sourceHeight = Math.max(1, image.naturalHeight || image.height);
    const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    let outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    let outputHeight = Math.max(1, Math.round(sourceHeight * scale));
    let smallestBlob = null;

    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare image");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, outputWidth, outputHeight);

      for (let quality = initialQuality; quality >= minQuality - 0.001; quality -= 0.08) {
        const blob = await canvasToBlob(canvas, "image/webp", quality);
        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
        if (blob.size <= maxBytes) {
          const base = String(file.name || baseName).replace(/\.[^.]+$/, "");
          return new File([blob], `${base}-optimized.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          });
        }
      }

      outputWidth = Math.max(320, Math.round(outputWidth * 0.82));
      outputHeight = Math.max(320, Math.round(outputHeight * 0.82));
    }

    if (!smallestBlob || smallestBlob.size > maxBytes) {
      throw new Error("Image cannot be compressed to the required size");
    }
    const base = String(file.name || baseName).replace(/\.[^.]+$/, "");
    return new File([smallestBlob], `${base}-optimized.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
