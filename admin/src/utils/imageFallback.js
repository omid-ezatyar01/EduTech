export const applyEduTechLogoFallback = (event) => {
  const image = event?.target;
  if (typeof HTMLImageElement === "undefined" || !(image instanceof HTMLImageElement)) return;
  event.stopPropagation?.();
  if (image.dataset.edutechLogoFallback === "true") return;
  image.dataset.edutechLogoFallback = "true";
  image.removeAttribute("srcset");
  image.removeAttribute("sizes");
  if (image.parentElement?.tagName === "PICTURE") {
    image.parentElement.querySelectorAll("source").forEach((source) => source.removeAttribute("srcset"));
  }
  image.style.objectFit = "contain";
  image.style.backgroundColor = "#ffffff";
  image.src = "/logo.png";
};
