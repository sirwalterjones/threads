// Unregister any existing service workers and clear caches to avoid stale builds
;(function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      registrations.forEach(function(reg) { reg.unregister(); });
    }).catch(function(){});
  }
  if (window.caches && typeof window.caches.keys === 'function') {
    caches.keys().then(function(keys) { keys.forEach(function(k) { caches.delete(k); }); }).catch(function(){});
  }
})();



