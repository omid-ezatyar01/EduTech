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
