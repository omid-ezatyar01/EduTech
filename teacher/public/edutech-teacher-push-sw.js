self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();

  const title = data.title || "EduTech";
  const options = {
    body: data.body || "You have a new EduTech notification.",
    icon: data.icon || "/icons/web-app-manifest-192x192.png",
    badge: data.badge || "/icons/favicon-96x96.png",
    tag:
      data.tag ||
      `${data.type || "teacher"}:${data.courseId || data.assignmentId || data.classId || ""}`,
    renotify: false,
    requireInteraction: false,
    timestamp: Date.now(),
    data: {
      url: data.url || "/teacher/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url || "/teacher/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      let targetUrl = new URL("/teacher/dashboard", self.location.origin).href;
      try {
        const requestedTarget = new URL(requestedUrl, self.location.origin);
        if (requestedTarget.origin === self.location.origin) targetUrl = requestedTarget.href;
      } catch {
        // Keep the safe same-origin fallback.
      }
      const existingClient = clients.find((client) => client.url === targetUrl);
      if (existingClient) return existingClient.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
