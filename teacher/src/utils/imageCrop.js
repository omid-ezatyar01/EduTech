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
  baseName = "course-image",
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

  const safeTargetWidth = Number(targetWidth || 0) > 0
    ? Math.round(Number(targetWidth))
    : Math.min(1600, Math.max(640, Math.round(frameWidth * 2)));
  const safeTargetHeight = Number(targetHeight || 0) > 0
    ? Math.round(Number(targetHeight))
    : Math.round((safeTargetWidth / frameWidth) * frameHeight);

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

export const fitImageFile = async ({
  file,
  outputType = "image/webp",
  quality = 0.92,
  targetWidth = 1200,
  targetHeight = 675,
  backgroundColor = "#f8fafc",
  baseName = "course-image",
}) => {
  if (!(file instanceof File)) {
    throw new Error("Invalid image file");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load image"));
      img.src = objectUrl;
    });

    const safeTargetWidth = Math.max(1, Math.round(Number(targetWidth) || 1200));
    const safeTargetHeight = Math.max(1, Math.round(Number(targetHeight) || 675));
    const imageWidth = Math.max(1, image.naturalWidth || image.width);
    const imageHeight = Math.max(1, image.naturalHeight || image.height);
    const scale = Math.min(safeTargetWidth / imageWidth, safeTargetHeight / imageHeight);
    const renderedWidth = imageWidth * scale;
    const renderedHeight = imageHeight * scale;

    const canvas = document.createElement("canvas");
    canvas.width = safeTargetWidth;
    canvas.height = safeTargetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to prepare fitted image");
    }

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, safeTargetWidth, safeTargetHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      (safeTargetWidth - renderedWidth) / 2,
      (safeTargetHeight - renderedHeight) / 2,
      renderedWidth,
      renderedHeight,
    );

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error("Unable to create fitted image"));
          return;
        }
        resolve(nextBlob);
      }, outputType, quality);
    });

    const extension =
      outputType === "image/png" ? "png" : outputType === "image/jpeg" ? "jpg" : "webp";
    const normalizedBaseName = String(file.name || baseName).replace(/\.[^.]+$/, "");
    return new File([blob], `${normalizedBaseName}-fitted.${extension}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const cropImageRegionFile = async ({
  file,
  crop,
  outputType = "image/webp",
  quality = 0.92,
  maxWidth = 1200,
  maxHeight = 675,
  baseName = "course-image",
}) => {
  if (!(file instanceof File)) {
    throw new Error("Invalid image file");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load image"));
      img.src = objectUrl;
    });

    const imageWidth = Math.max(1, image.naturalWidth || image.width);
    const imageHeight = Math.max(1, image.naturalHeight || image.height);
    const normalizedCrop = {
      x: clamp(Number(crop?.x || 0), 0, 1),
      y: clamp(Number(crop?.y || 0), 0, 1),
      width: clamp(Number(crop?.width || 1), 0.01, 1),
      height: clamp(Number(crop?.height || 1), 0.01, 1),
    };
    const sourceX = Math.round(normalizedCrop.x * imageWidth);
    const sourceY = Math.round(normalizedCrop.y * imageHeight);
    const sourceWidth = Math.max(
      1,
      Math.min(imageWidth - sourceX, Math.round(normalizedCrop.width * imageWidth)),
    );
    const sourceHeight = Math.max(
      1,
      Math.min(imageHeight - sourceY, Math.round(normalizedCrop.height * imageHeight)),
    );
    const scale = Math.min(
      1,
      Math.max(1, Number(maxWidth) || 1200) / sourceWidth,
      Math.max(1, Number(maxHeight) || 675) / sourceHeight,
    );
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to prepare cropped image");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputWidth,
      outputHeight,
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

    const extension =
      outputType === "image/png" ? "png" : outputType === "image/jpeg" ? "jpg" : "webp";
    const normalizedBaseName = String(file.name || baseName).replace(/\.[^.]+$/, "");
    return new File([blob], `${normalizedBaseName}-cropped.${extension}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const cropFittedImageRegionFile = async ({
  file,
  crop,
  outputType = "image/webp",
  quality = 0.92,
  targetWidth = 1200,
  targetHeight = 675,
  backgroundColor = "#f8fafc",
  baseName = "course-image",
}) => {
  if (!(file instanceof File)) {
    throw new Error("Invalid image file");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load image"));
      img.src = objectUrl;
    });
    const safeTargetWidth = Math.max(1, Math.round(Number(targetWidth) || 1200));
    const safeTargetHeight = Math.max(1, Math.round(Number(targetHeight) || 675));
    const imageWidth = Math.max(1, image.naturalWidth || image.width);
    const imageHeight = Math.max(1, image.naturalHeight || image.height);
    const imageScale = Math.min(
      safeTargetWidth / imageWidth,
      safeTargetHeight / imageHeight,
    );
    const renderedWidth = imageWidth * imageScale;
    const renderedHeight = imageHeight * imageScale;

    const fittedCanvas = document.createElement("canvas");
    fittedCanvas.width = safeTargetWidth;
    fittedCanvas.height = safeTargetHeight;
    const fittedContext = fittedCanvas.getContext("2d");
    if (!fittedContext) throw new Error("Unable to prepare fitted image");

    fittedContext.fillStyle = backgroundColor;
    fittedContext.fillRect(0, 0, safeTargetWidth, safeTargetHeight);
    fittedContext.imageSmoothingEnabled = true;
    fittedContext.imageSmoothingQuality = "high";
    fittedContext.drawImage(
      image,
      (safeTargetWidth - renderedWidth) / 2,
      (safeTargetHeight - renderedHeight) / 2,
      renderedWidth,
      renderedHeight,
    );

    const normalizedCrop = {
      x: clamp(Number(crop?.x || 0), 0, 1),
      y: clamp(Number(crop?.y || 0), 0, 1),
      width: clamp(Number(crop?.width || 1), 0.01, 1),
      height: clamp(Number(crop?.height || 1), 0.01, 1),
    };
    const sourceX = Math.round(normalizedCrop.x * safeTargetWidth);
    const sourceY = Math.round(normalizedCrop.y * safeTargetHeight);
    const sourceWidth = Math.max(
      1,
      Math.min(
        safeTargetWidth - sourceX,
        Math.round(normalizedCrop.width * safeTargetWidth),
      ),
    );
    const sourceHeight = Math.max(
      1,
      Math.min(
        safeTargetHeight - sourceY,
        Math.round(normalizedCrop.height * safeTargetHeight),
      ),
    );

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = safeTargetWidth;
    outputCanvas.height = safeTargetHeight;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) throw new Error("Unable to prepare cropped image");

    const outputScale = Math.min(
      safeTargetWidth / sourceWidth,
      safeTargetHeight / sourceHeight,
    );
    const outputImageWidth = sourceWidth * outputScale;
    const outputImageHeight = sourceHeight * outputScale;
    outputContext.fillStyle = backgroundColor;
    outputContext.fillRect(0, 0, safeTargetWidth, safeTargetHeight);
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";
    outputContext.drawImage(
      fittedCanvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      (safeTargetWidth - outputImageWidth) / 2,
      (safeTargetHeight - outputImageHeight) / 2,
      outputImageWidth,
      outputImageHeight,
    );

    const blob = await new Promise((resolve, reject) => {
      outputCanvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error("Unable to create cropped image"));
          return;
        }
        resolve(nextBlob);
      }, outputType, quality);
    });
    const extension =
      outputType === "image/png" ? "png" : outputType === "image/jpeg" ? "jpg" : "webp";
    const normalizedBaseName = String(file.name || baseName).replace(/\.[^.]+$/, "");
    return new File([blob], `${normalizedBaseName}-cropped.${extension}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

  const safeMaxBytes = Math.max(32 * 1024, Number(maxBytes || 0));
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
    const initialScale = Math.min(
      1,
      Math.max(1, Number(maxWidth || sourceWidth)) / sourceWidth,
      Math.max(1, Number(maxHeight || sourceHeight)) / sourceHeight,
    );
    let outputWidth = Math.max(1, Math.round(sourceWidth * initialScale));
    let outputHeight = Math.max(1, Math.round(sourceHeight * initialScale));
    let bestBlob = null;

    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare image");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, outputWidth, outputHeight);

      for (
        let quality = Math.min(0.92, Math.max(minQuality, initialQuality));
        quality >= minQuality - 0.001;
        quality -= 0.08
      ) {
        const blob = await canvasToBlob(canvas, outputType, quality);
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
        if (blob.size <= safeMaxBytes) {
          const extension = outputType === "image/jpeg" ? "jpg" : "webp";
          const normalizedBaseName = String(file.name || baseName).replace(/\.[^.]+$/, "");
          return new File([blob], `${normalizedBaseName}-optimized.${extension}`, {
            type: outputType,
            lastModified: Date.now(),
          });
        }
      }

      outputWidth = Math.max(320, Math.round(outputWidth * 0.82));
      outputHeight = Math.max(320, Math.round(outputHeight * 0.82));
    }

    if (!bestBlob || bestBlob.size > safeMaxBytes) {
      throw new Error("Image cannot be compressed to the required size");
    }
    const normalizedBaseName = String(file.name || baseName).replace(/\.[^.]+$/, "");
    return new File([bestBlob], `${normalizedBaseName}-optimized.webp`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
