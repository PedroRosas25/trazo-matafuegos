self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalado');
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Con solo escuchar el evento 'fetch', Chrome ya asume que somos una App real.
});