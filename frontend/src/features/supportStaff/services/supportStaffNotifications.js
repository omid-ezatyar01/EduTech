import {
  fetchSupportPushConfig,
  saveSupportPushSubscription,
} from "./supportStaffApi.js";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const getSupportNotificationPermission = () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
};

export const enableSupportStaffNotifications = async () => {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const config = await fetchSupportPushConfig();
  if (!config?.enabled || !config?.publicKey) return false;

  await navigator.serviceWorker.register("/edutech-push-sw.js");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    }));
  await saveSupportPushSubscription(subscription);
  return true;
};

export const showSupportDesktopNotification = (payload = {}, isFa = false) => {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const ticket = payload?.ticket || {};
  const message = payload?.message || {};
  if (["support", "admin"].includes(message?.senderRole)) return;

  const notification = new Notification(
    isFa ? `درخواست جدید: ${ticket.subject || "پشتیبانی"}` : `New support request: ${ticket.subject || "Support"}`,
    {
      body: message.body || ticket.lastMessagePreview || "",
      icon: "/icons/web-app-manifest-192x192.png",
      badge: "/icons/favicon-96x96.png",
      tag: `support-ticket-${ticket.id || ""}`,
    },
  );
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};
