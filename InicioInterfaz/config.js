// Configuración global del frontend
// Cambia aquí el backend y todos los módulos lo tomarán automáticamente.

// Intento de autodetección: si se despliega en otro dominio/puerto se puede ajustar BACKEND_URL manualmente
(() => {
  const DEFAULT_PORT = 4000;
  const loc = window.location;
  const LS_KEY = 'APP_BACKEND_URL';
  // Intentar leer override desde backend.json (sincrónico para inicializar antes que el resto)
  function readBackendJson(){
    try {
      const xhr = new XMLHttpRequest();
      // intentar desde raíz y relativo
      const cand = [
        '/backend.json',
        'backend.json'
      ];
      for (const url of cand){
        try {
          xhr.open('GET', url, false);
          xhr.send(null);
          if (xhr.status >= 200 && xhr.status < 300) {
            const obj = JSON.parse(xhr.responseText||'{}');
            if (obj && obj.backend && /^https?:\/\//i.test(obj.backend)) return obj.backend;
          }
        } catch {}
      }
    } catch {}
    return '';
  }
  // Permitir override por query (?backend=https://mi-backend.dominio)
  try {
    const qp = new URLSearchParams(loc.search);
    const backendQP = qp.get('backend');
    if (backendQP && /^https?:\/\//i.test(backendQP)) {
      localStorage.setItem(LS_KEY, backendQP);
    }
  } catch {}
  const stored = (()=>{ try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; } })();
  // Si estamos ya en el puerto del backend (4000) asumimos mismo origen.
  let candidate;
  const fileOverride = readBackendJson();
  if (stored) {
    candidate = stored;
  } else if (fileOverride) {
    candidate = fileOverride;
  } else if(loc.protocol.startsWith('http') && Number(loc.port) === DEFAULT_PORT){
    candidate = loc.origin; // mismo host:puerto
  } else {
    // Manejar file:// o cualquier otro puerto → apuntar al backend estándar
    const host = (!loc.hostname || loc.hostname === '' || loc.protocol === 'file:') ? 'localhost' : loc.hostname;
    candidate = `http://${host}:${DEFAULT_PORT}`;
  }
  window.APP_CONFIG = {
    BACKEND: candidate,
    API_BASE: candidate + '/api',
    ADMIN_TOKEN: (function(){ try { return (JSON.parse(localStorage.getItem('APP_BACKEND_ADMIN')||'{}').token) || 'bh-admin-2025'; } catch { return 'bh-admin-2025'; } })(),
    // Incrementar este número cuando se reemplacen imágenes para forzar recarga (cache busting)
  ASSET_VERSION: 2
  };

  // Health check para confirmar disponibilidad; si falla dejamos config pero marcamos flag
  fetch(window.APP_CONFIG.API_BASE + '/health', { method:'GET' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('status '+r.status)))
    .then(() => { console.info('[CONFIG] Backend detectado en', window.APP_CONFIG.BACKEND); })
    .catch(()=>{
      console.warn('[CONFIG] Backend no responde en', window.APP_CONFIG.BACKEND, '— se usará fallback local en catálogos.');
      window.APP_CONFIG.BACKEND_UNAVAILABLE = true;
    });
  // Utilidad para cambiar backend desde consola o UI
  window.__setBackend = function(url){
    try { if(url) localStorage.setItem(LS_KEY, url); else localStorage.removeItem(LS_KEY); } catch {}
    alert('Backend actualizado. Recargando...');
    location.reload();
  };
})();
