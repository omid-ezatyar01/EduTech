self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();

  const options = {
    body: data.body || "A new review request is waiting.",
    icon: data.icon || "/logo.png",
    badge: data.badge || "/icons/favicon-96x96.png",
    tag: data.type
      ? `${data.type}:${data.courseId || data.teacherId || ""}`
      : "admin-review",
    data: {
      url: data.url || "/",
      type: data.type || "",
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "EduTech Admin",
      options,
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const target = new URL(targetUrl, self.location.origin).href;
        const existingClient = clients.find((client) => client.url === target);
        if (existingClient) return existingClient.focus();
        return self.clients.openWindow(targetUrl);
      }),
  );
});
