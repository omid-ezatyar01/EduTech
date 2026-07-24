const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const loadImageDimensions = (file) =>
  new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      reject(new Error("Invalid image file"));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to load image"));
    };
    image.src = objectUrl;
  });

export const getCoverCropBounds = ({
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  zoom = 1,
}) => {
  const safeImageWidth = Math.max(1, Number(imageWidth || 1));
  const safeImageHeight = Math.max(1, Number(imageHeight || 1));
  const safeFrameWidth = Math.max(1, Number(frameWidth || 1));
  const safeFrameHeight = Math.max(1, Number(frameHeight || 1));
  const safeZoom = Math.max(1, Number(zoom || 1));

  const baseScale = Math.max(
    safeFrameWidth / safeImageWidth,
    safeFrameHeight / safeImageHeight,
  );
  const scale = baseScale * safeZoom;
  const renderedWidth = safeImageWidth * scale;
  const renderedHeight = safeImageHeight * scale;

  return {
    scale,
    renderedWidth,
    renderedHeight,
    maxOffsetX: Math.max(0, (renderedWidth - safeFrameWidth) / 2),
    maxOffsetY: Math.max(0, (renderedHeight - safeFrameHeight) / 2),
  };
};

export const clampCropPosition = (position = {}, bounds = {}) => ({
  x: clamp(Number(position.x || 0), -Number(bounds.maxOffsetX || 0), Number(bounds.maxOffsetX || 0)),
  y: clamp(Number(position.y || 0), -Number(bounds.maxOffsetY || 0), Number(bounds.maxOffsetY || 0)),
});

export const cropImageFile = async ({
  file,
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  position,
  zoom = 1,
  outputType = "image/webp",
  quality = 0.92,
  targetWidth,
  targetHeight,
  baseName = "profile-image",
}) => {
  const bounds = getCoverCropBounds({
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    zoom,
  });
  const limitedPosition = clampCropPosition(position, bounds);

  const sourceX = clamp(
    (-limitedPosition.x - (frameWidth - bounds.renderedWidth) / 2) / bounds.scale,
    0,
    imageWidth,
  );
  const sourceY = clamp(
    (-limitedPosition.y - (frameHeight - bounds.renderedHeight) / 2) / bounds.scale,
    0,
    imageHeight,
  );
  const sourceWidth = clamp(frameWidth / bounds.scale, 1, imageWidth);
  const sourceHeight = clamp(frameHeight / bounds.scale, 1, imageHeight);
  const finalSourceX = clamp(sourceX, 0, Math.max(0, imageWidth - sourceWidth));
  const finalSourceY = clamp(sourceY, 0, Math.max(0, imageHeight - sourceHeight));

  const safeTargetWidth = Number(targetWidth || 0) > 0 ? Math.round(Number(targetWidth)) : 800;
  const safeTargetHeight = Number(targetHeight || 0) > 0 ? Math.round(Number(targetHeight)) : 800;

  const objectUrl = URL.createObjectURL(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image"));
    img.src = objectUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = safeTargetWidth;
  canvas.height = safeTargetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Unable to prepare cropped image");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    finalSourceX,
    finalSourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    safeTargetWidth,
    safeTargetHeight,
  );

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("Unable to create cropped image"));
        return;
      }
      resolve(nextBlob);
    }, outputType, quality);
  });

  URL.revokeObjectURL(objectUrl);

  const extension = outputType === "image/png" ? "png" : outputType === "image/jpeg" ? "jpg" : "webp";
  const normalizedBaseName = String(file.name || baseName).replace(/\.[^.]+$/, "");
  return new File([blob], `${normalizedBaseName}-cropped.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
};

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
  outputType = "image/webp",
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
    const initialScale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    let outputWidth = Math.max(1, Math.round(sourceWidth * initialScale));
    let outputHeight = Math.max(1, Math.round(sourceHeight * initialScale));
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
        const blob = await canvasToBlob(canvas, outputType, quality);
        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
        if (blob.size <= maxBytes) {
          const base = String(file.name || baseName).replace(/\.[^.]+$/, "");
          return new File([blob], `${base}-optimized.webp`, {
            type: outputType,
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
      type: outputType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
