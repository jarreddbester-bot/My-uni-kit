const CACHE_NAME = "uni-kit-v6";
const PRECACHE_FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "data.js",
  "manifest.json",
  "fonts/Anton-Regular.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "images/kits/1992-93-away.jpg",
  "images/kits/1992-93-home.jpg",
  "images/kits/1992-93-third.jpg",
  "images/kits/1993-94-away.jpg",
  "images/kits/1993-94-home.jpg",
  "images/kits/1993-94-third.jpg",
  "images/kits/1994-95-away.jpg",
  "images/kits/1994-95-home.jpg",
  "images/kits/1994-95-third.jpg",
  "images/kits/1995-96-away.jpg",
  "images/kits/1995-96-home.jpg",
  "images/kits/1995-96-third.jpg",
  "images/kits/1996-97-away.jpg",
  "images/kits/1996-97-home.jpg",
  "images/kits/1996-97-third.jpg",
  "images/kits/1997-98-away.jpg",
  "images/kits/1997-98-home.jpg",
  "images/kits/1997-98-third.jpg",
  "images/kits/1998-99-away.jpg",
  "images/kits/1998-99-home.jpg",
  "images/kits/1998-99-third.jpg",
  "images/kits/1999-00-away.jpg",
  "images/kits/1999-00-home.jpg",
  "images/kits/1999-00-third.jpg",
  "images/kits/2000-01-away.jpg",
  "images/kits/2000-01-home.jpg",
  "images/kits/2000-01-third.jpg",
  "images/kits/2001-02-away.jpg",
  "images/kits/2001-02-home.jpg",
  "images/kits/2001-02-third.jpg",
  "images/kits/2002-03-away.jpg",
  "images/kits/2002-03-home.jpg",
  "images/kits/2002-03-third.jpg",
  "images/kits/2003-04-away.jpg",
  "images/kits/2003-04-home.jpg",
  "images/kits/2003-04-third.jpg",
  "images/kits/2004-05-away.jpg",
  "images/kits/2004-05-home.jpg",
  "images/kits/2004-05-third.jpg",
  "images/kits/2005-06-away.jpg",
  "images/kits/2005-06-home.jpg",
  "images/kits/2005-06-third.jpg",
  "images/kits/2006-07-away.jpg",
  "images/kits/2006-07-home.jpg",
  "images/kits/2006-07-third.jpg",
  "images/kits/2007-08-away.jpg",
  "images/kits/2007-08-home.jpg",
  "images/kits/2007-08-third.jpg",
  "images/kits/2008-09-away.jpg",
  "images/kits/2008-09-home.jpg",
  "images/kits/2008-09-third.jpg",
  "images/kits/2009-10-away.jpg",
  "images/kits/2009-10-home.jpg",
  "images/kits/2009-10-third.jpg",
  "images/kits/2010-11-away.jpg",
  "images/kits/2010-11-home.jpg",
  "images/kits/2010-11-third.jpg",
  "images/kits/2011-12-away.jpg",
  "images/kits/2011-12-home.jpg",
  "images/kits/2011-12-third.jpg",
  "images/kits/2012-13-away.jpg",
  "images/kits/2012-13-home.jpg",
  "images/kits/2012-13-third.jpg",
  "images/kits/2013-14-away.jpg",
  "images/kits/2013-14-home.jpg",
  "images/kits/2013-14-third.jpg",
  "images/kits/2014-15-away.jpg",
  "images/kits/2014-15-home.jpg",
  "images/kits/2014-15-third.jpg",
  "images/kits/2015-16-away.jpg",
  "images/kits/2015-16-home.jpg",
  "images/kits/2015-16-third.jpg",
  "images/kits/2016-17-away.jpg",
  "images/kits/2016-17-home.jpg",
  "images/kits/2016-17-third.jpg",
  "images/kits/2017-18-away.jpg",
  "images/kits/2017-18-home.jpg",
  "images/kits/2017-18-third.jpg",
  "images/kits/2018-19-away.jpg",
  "images/kits/2018-19-home.jpg",
  "images/kits/2018-19-third.jpg",
  "images/kits/2019-20-away.jpg",
  "images/kits/2019-20-home.jpg",
  "images/kits/2019-20-third.jpg",
  "images/kits/2020-21-away.jpg",
  "images/kits/2020-21-home.jpg",
  "images/kits/2020-21-third.jpg",
  "images/kits/2021-22-away.jpg",
  "images/kits/2021-22-home.jpg",
  "images/kits/2021-22-third.jpg",
  "images/kits/2022-23-away.jpg",
  "images/kits/2022-23-home.jpg",
  "images/kits/2022-23-third.jpg",
  "images/kits/2023-24-away.jpg",
  "images/kits/2023-24-home.jpg",
  "images/kits/2023-24-third.jpg",
  "images/kits/2024-25-away.jpg",
  "images/kits/2024-25-home.jpg",
  "images/kits/2024-25-third.jpg",
  "images/kits/2025-26-away.jpg",
  "images/kits/2025-26-home.jpg",
  "images/kits/2025-26-third.jpg",
  "images/kits/2026-27-away.jpg",
  "images/kits/2026-27-home.jpg",
  "images/kits/2026-27-third.jpg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_FILES);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// App-shell files can change on every deploy, so they must be checked against
// the network first (falling back to cache only when offline). Images/fonts/
// icons never change once bundled, so those stay cache-first for speed and
// full offline availability.
var APP_SHELL_RE = /(\/|index\.html|app\.js|style\.css|data\.js|manifest\.json)$/;

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  var isAppShell = APP_SHELL_RE.test(url.pathname);

  if (isAppShell) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        return response;
      }).catch(function () {
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });
        return response;
      }).catch(function () {
        return cached;
      });
    })
  );
});
