
/* Lok Yi Hub · Service Worker（離線快取） */
const CACHE = &#x27;lyhub-v30&#x27;;
const ASSETS = [
  &#x27;./&#x27;,
  &#x27;./index.html&#x27;,
  &#x27;./styles.css&#x27;,
  &#x27;./script.js&#x27;,
  &#x27;./manifest.json&#x27;,
  &#x27;./icons/icon-192.png&#x27;,
  &#x27;./icons/icon-512.png&#x27;,
  &#x27;./icons/icon-maskable-512.png&#x27;,
  &#x27;./icons/apple-touch-icon.png&#x27;
];

self.addEventListener(&#x27;install&#x27;, e =&gt; {
  e.waitUntil(caches.open(CACHE).then(c =&gt; c.addAll(ASSETS)).then(() =&gt; self.skipWaiting()));
});

self.addEventListener(&#x27;activate&#x27;, e =&gt; {
  e.waitUntil(
    caches.keys().then(keys =&gt; Promise.all(keys.filter(k =&gt; k !== CACHE).map(k =&gt; caches.delete(k))))
      .then(() =&gt; self.clients.claim())
  );
});

self.addEventListener(&#x27;fetch&#x27;, e =&gt; {
  if (e.request.method !== &#x27;GET&#x27;) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =&gt; {
      const net = fetch(e.request).then(res =&gt; {
        if (res &amp;&amp; res.ok &amp;&amp; new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c =&gt; c.put(e.request, copy));
        }
        return res;
      }).catch(() =&gt; hit);
      return hit || net;
    })
  );
});

