import { getApiBase } from "../../services/http";

const getApiOrigin = () => {
  try {
    return new URL(getApiBase()).origin;
  } catch {
    return "";
  }
};

export const resolveAvatarUrl = (avatar) => {
  if (!avatar || typeof avatar !== "string") return "";

  const apiOrigin = getApiOrigin();

  if (avatar.startsWith("/uploads/")) {
    return apiOrigin ? `${apiOrigin}${avatar}` : avatar;
  }

  if (/^https?:\/\//i.test(avatar)) {
    try {
      const parsed = new URL(avatar);
      const isUploadsPath = parsed.pathname.startsWith("/uploads/");
      const apiHost = apiOrigin ? new URL(apiOrigin).host : "";
      const avatarHost = parsed.host;

      if (isUploadsPath && apiOrigin && avatarHost !== apiHost) {
        return `${apiOrigin}${parsed.pathname}${parsed.search}`;
      }
      return avatar;
    } catch {
      return avatar;
    }
  }

  return avatar;
};
