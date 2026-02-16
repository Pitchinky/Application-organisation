self.addEventListener('install', (e) => {
    console.log('Service Worker installé');
  });
  
  self.addEventListener('fetch', (e) => {
    // Nécessaire pour le mode offline plus tard
  });