// Service Worker for handling Web Push Notifications
self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const notification = payload.notification || {};
    const title = notification.title || 'New Notification';
    const options = {
      body: notification.body || '',
      icon: '/favicon.ico', // fallback to favicon
      badge: '/favicon.ico',
      data: notification.data || {},
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('New Notification', {
        body: text,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
      })
    );
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  // Redirect client to specified URL or dashboard
  let urlToOpen = '/dashboard';
  if (event.notification.data && event.notification.data.url) {
    urlToOpen = event.notification.data.url;
  }

  // Resolve absolute URL
  const resolvedUrl = new URL(urlToOpen, self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Find matching window client and focus/navigate it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(resolvedUrl);
          }
          return client.focus();
        }
      }
      // Open new window if none found
      if (self.clients.openWindow) {
        return self.clients.openWindow(resolvedUrl);
      }
    })
  );
});
