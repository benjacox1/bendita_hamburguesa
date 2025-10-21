// Configuración global del frontend
// Cambia aquí el backend y todos los módulos lo tomarán automáticamente.

// Intento de autodetección: si se despliega en otro dominio/puerto se puede ajustar BACKEND_URL manualmente
(() => {
  const DEFAULT_PORT = 4000;
  const loc = window.location;
  let candidate = '';
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
  const fileOverride = readBackendJson();
  if (fileOverride) {
    candidate = fileOverride;
  } else if(loc.protocol.startsWith('http') && Number(loc.port) === DEFAULT_PORT){
    candidate = loc.origin; // mismo host:puerto
  } else {
    const host = (!loc.hostname || loc.hostname === '' || loc.protocol === 'file:') ? 'localhost' : loc.hostname;
    candidate = `http://${host}:${DEFAULT_PORT}`;
  }
  window.APP_CONFIG = {
    BACKEND: candidate,
    API_BASE: candidate + '/api',
    ASSET_VERSION: 2
  };
  fetch(window.APP_CONFIG.API_BASE + '/health', { method:'GET' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('status '+r.status)))
    .then(() => { console.info('[CONFIG] Backend detectado en', window.APP_CONFIG.BACKEND); })
    .catch(()=>{
      console.warn('[CONFIG] Backend no responde en', window.APP_CONFIG.BACKEND, '— se usará fallback local en catálogos.');
      window.APP_CONFIG.BACKEND_UNAVAILABLE = true;
    });
})();
