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
    icon: data.icon || "/icons/android-chrome-192x192.png",
    badge: data.badge || "/icons/favicon-32x32.png",
    data: {
      url: data.url || "https://edutech.study/live-courses",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "https://edutech.study/live-courses";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url === targetUrl);
      if (existingClient) return existingClient.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
