// إضافة صفحة عدم الاتصال إلى قائمة الملفات المخزنة
const urlsToCache = [
  // ... الملفات السابقة
  '/offline.html'
];

// تعديل دالة fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(networkResponse => {
            return networkResponse;
          })
          .catch(error => {
            // إذا فشل الاتصال بالشبكة، أظهر صفحة عدم الاتصال
            return caches.match('/offline.html');
          });
      })
  );
});
const CACHE_NAME = 'obd-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/script.js',
  '/manifest.json',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/lang/en.json',
  '/lang/fr.json',
  '/lang/ar.json'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ تم فتح الكاش');
        return cache.addAll(urlsToCache);
      })
  );
});

// تفعيل Service Worker وحذف الكاش القديم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ حذف الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// استقبال الطلبات والرد من الكاش أو الشبكة
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا وجد الملف في الكاش، أرسله
        if (response) {
          return response;
        }

        // إذا لم يوجد، ابحث من الشبكة
        return fetch(event.request).then(networkResponse => {
          // لا نخزن كل الطلبات، فقط الأساسيات
          return networkResponse;
        });
      })
  );
});