self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const notificationType = String(data.type || "").toLowerCase();
  const defaultUrlByType = {
    course_created: "/live-courses",
    course_published: "/live-courses",
    teacher_added: "/teachers",
    teacher_created: "/teachers",
    support_ticket_created: "/support-team",
    support_ticket_message: "/support-team",
  };

  const resolveTargetUrl = () => {
    if (data.url) return data.url;
    return defaultUrlByType[notificationType] || "/live-courses";
  };

  const title =
    data.title ||
    (notificationType.startsWith("support")
      ? "New support request"
      : notificationType.startsWith("teacher")
      ? "New teacher on EduTech"
      : "New course on EduTech");

  const body =
    data.body ||
    (notificationType.startsWith("support")
      ? "A user is waiting for support."
      : notificationType.startsWith("teacher")
      ? "A new teacher has joined EduTech."
      : "You have a new EduTech notification.");

  const options = {
    body,
    icon: data.icon || "/icons/web-app-manifest-192x192.png",
    badge: data.badge || "/icons/favicon-96x96.png",
    data: {
      url: resolveTargetUrl(),
      type: notificationType,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/live-courses";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const target = new URL(targetUrl, self.location.origin).href;
      const existingClient = clients.find((client) => client.url === target);
      if (existingClient) return existingClient.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
