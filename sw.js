/* ملف الخدمة: يحفظ الصفحة على الجهاز لتفتح بدون إنترنت، ويجلب النسخة الأحدث كلما توفر الاتصال */
const CACHE = 'app-v1:' + self.registration.scope;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(
    ['./', './index.html'].map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))
  )));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith('app-v1:' + self.registration.scope)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // الخطوط: من الذاكرة أولاً ثم تحديثها بالخلفية
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // الصفحة وملفات الموقع نفسه: الشبكة أولاً (تحديث فوري)، وعند انقطاع الاتصال من الذاكرة
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' })).then((r) => {
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return r;
      }).catch(async () => {
        const c = await caches.open(CACHE);
        return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? (await c.match('./index.html')) || (await c.match('./')) : undefined) || Response.error();
      })
    );
  }
  // أي نطاق آخر (قاعدة بيانات Firebase وغيرها) يمر كما هو بدون تدخل
});
