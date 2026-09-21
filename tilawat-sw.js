// Service Worker — يستقبل إشعارات Web Push ويعرضها حتى والموقع مغلق.
const ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAACAVBMVEVMaXF1aFp1Z1l2Z1t0aFl1Z1p1Zlp0Z1p1aFp/f391aFp0Zlh2ZFt1aFl1Z1l2Zlp0Z1p1Z1l1aFp0Z1t2aVl1Z1l1aFp0Z1l1Z1l0aVt3Zl10Z1l0aFp1Z1l0Z1p0aFl0Z1l0Z1lzaFx1Z1p1Z1p1aVp1aFl0Z1p4a110aFl5bVV0Z1lxY1Vzalp1aFp2aFl1aFt1aFl0Z1pxZ150Z1l0Z1p2aFtyaVd1Z1pzZ1h0aFl1Z1pVVVV1aFp0aFl0aFp1aFp1Z1l0aFr9/f11aFrTz8qPhHmxqaF2aVuimZD6+vrCvbf6+fl6bWD8/Pyflo3m5OHEvrjr6ed+cmWQhXrh39zz8vHRzcjo5uTq6Oa7ta7r6ejSzcnh3tvs6+n39vV3alyRhnvSzsrKxcB3al3CvLa3sKnY1NDa1tPj4d6IfXF9cWSVi4Cgl42spZyCdmqDd2u+uLGspJymnZWyqqPV0c309PP4+Pfy8fChmY+BdWiYj4S/ubKhmI+tpZ3Ev7nQzMe+uLKYjoR/c2b5+PiFeW3HwrzLxsF6bmCZkIaGem6Sh3zk4d/7+/vOysXKxb/x8O+HfG+ro5ve29eNg3d7b2Ll4+H29fXJxL/IxL/d2tfs6umKf3Onn5aelYv5+fjn5ePt6+qLgHTAu7Xi4N3u7evi392jmpH8/PudlIqdk4rK3AxeAAAAQ3RSTlMA/rZUU7tX+/wC60gc+pRSuOCSUWG57exKRh798O/u8ti+FrS9VdXWE+MVsxIfXUdiZGUbXupfHdlW4eID17yTt5HfcnNZjgAAAAlwSFlzAAALEwAACxMBAJqcGAAAAyFJREFUeNrtmmV3GlEQhjdIII1b06RNmjYudXfhArs4BILE3dO4u7vU3f1XliWQ7JIlZ4E7/bTvF2BnzvvA3cueMzOXIFg6GxmXW5SJQlRmUW7crWIioKLED+UobMlFkihu/8ibCJOy8zjsM6QIo1Jv+PufSENYlRbN9r8qQ5glv8z0vxiBsCsihbE+MgQg2QWff8wxBKLj57wAKQJSgnf/IzBJaP+72XCAe/R/WowAFe8GJEACctzPTzkkQFYIeYtpiYk4WEAScQYWICXuwAISidOwgFPESViAnEDAOgKgL3tSxsfCnaYPEmCdtdtGFB69qmjRTllJrizSOqVtqajZyxupss9a+QI6NQo/lSv75tk5893Kcv8sTSdPwLKCQ5/qjbW+hFpjvY4rZ5knQKngVsXTRs/SUJ8DJCiDAeiqHbaqNssQy8FJIfTLybo0ZGmrsjmqdUEDVN4PHev9ZpNh329wcP+twWTuX+/wpqlCBng01v3MwF4Nw9u+MWZGmAC32qcXDuwXzO1+4fABCPVovdtX09RzKIgDgNDzd3TkRx1HCA8ADdCRAQQHUNMRtQAQAAJAAAgAASAABIAAEAD/FUDNrVKUcbxujTwKQK7VjRspanWOChqwr+GNGbWKPAwgVeqZjeHQi0C/QnnrbyMT0Phnqzz0KrOSs0bdadr1AXabdjhTKnkCmgOUwZptF/3iatAESGjmCdDbN3XO1oaliV7tdv33GobDb0+BybhQ87PytbZ3Yqmh1anbtOt5d1tWmFtncXLaxPV9TebJReaGWgm2ncPUV9cXtnu1633Y/SK/5s1H24H9yw+1GBpShxBdlj17SxeJpePFcfe/0f5vXmBqqXFp1OEYxdazw9QUBG9rgjdmb8MCHsM3xx/AAh5BDygkRLEM0j+2lCBEkIAS9xRKAglIpgft+XD+BZ7hex7sD3ArFcpfBD3uzfANlKNhBtbpByPxFIiR+3XmUP98LPbn9CX2sYRozPfhWrr/wYoYrGNf0RWOsyGSAlz2+fEBDs/E52DYTrElyVGBD+gUipPuJ2aF6p2VKE2SlLIt/wEKCUcyM79fXgAAAABJRU5ErkJggg=='

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch (e) { d = { title: 'تلاوات', body: event.data ? event.data.text() : '' } }

  event.waitUntil((async () => {
    // إن كانت الصفحة مفتوحة أمامك فالتنبيه يظهر داخلها، فلا نكرره كإشعار نظام
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins.some((w) => w.visibilityState === 'visible')) return
    await self.registration.showNotification(d.title || 'تلاوات', {
      body: d.body || '',
      icon: ICON,
      badge: ICON,
      tag: d.tag,
      dir: 'rtl',
      lang: 'ar',
      data: { url: d.url },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) { if ('focus' in w) return w.focus() }
    return self.clients.openWindow(url)
  })())
})
