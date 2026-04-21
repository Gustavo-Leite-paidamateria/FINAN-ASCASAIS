const CACHE_NAME = 'financa-casal-v3-fix';

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
