// Configuración global del frontend
// Cambia aquí el backend y todos los módulos lo tomarán automáticamente.

// Intento de autodetección: si se despliega en otro dominio/puerto se puede ajustar BACKEND_URL manualmente
(() => {
  const DEFAULT_PORT = 4000;
  const loc = window.location;
  // Si estamos ya en el puerto del backend (4000) asumimos mismo origen.
  let candidate;
  if(loc.protocol.startsWith('http') && Number(loc.port) === DEFAULT_PORT){
    candidate = loc.origin; // mismo host:puerto
  } else {
    // Manejar file:// o cualquier otro puerto → apuntar al backend estándar
    const host = (!loc.hostname || loc.hostname === '' || loc.protocol === 'file:') ? 'localhost' : loc.hostname;
    candidate = `http://${host}:${DEFAULT_PORT}`;
  }
  window.APP_CONFIG = {
    BACKEND: candidate,
    API_BASE: candidate + '/api',
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
})();
