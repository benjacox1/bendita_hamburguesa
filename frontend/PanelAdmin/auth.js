// Autenticación básica del Panel Admin (credenciales fijas en frontend)
// Nota: Esto protege solo a nivel de UI. Para seguridad real, validar en backend.

(function(){
  const KEY = 'admin_session_v2';
  const EXP_MINUTES = 8 * 60; // 8 horas

  function nowTs(){ return Date.now(); }
  function addMinutes(ms, mins){ return ms + mins*60*1000; }

  function getSession(){
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  }
  function setSession(payload){ localStorage.setItem(KEY, JSON.stringify(payload)); }
  function clearSession(){ localStorage.removeItem(KEY); }

  function isValidSession(sess){
    if(!sess || !sess.user || !sess.token || !sess.exp) return false;
    return nowTs() < sess.exp;
  }

  function redirectToLogin(){
    // Mantener ruta del panel por si se quiere volver post-login
    const target = location.pathname.replace(/[^/]*$/, '') + 'login.html';
    location.replace(target + '?next=' + encodeURIComponent(location.href));
  }

  function requireAuth(){
    const s = getSession();
    if(!isValidSession(s)) redirectToLogin();
  }

  function adminLogin(user, pass){
    // Credenciales fijas (modificar aquí)
    const FIXED_USER = 'benja1906';
    const FIXED_PASS = '1595';

    if(user === FIXED_USER && pass === FIXED_PASS){
      const exp = addMinutes(nowTs(), EXP_MINUTES);
      // Token para backend: usar fijo compatible con server.js (ADMIN_TOKEN)
      const apiToken = 'bh-admin-2025';
      const token = btoa(`${user}:${exp}`);
      setSession({ user, token, apiToken, exp });
      return { ok: true };
    }
    return { ok: false, error: 'Usuario o contraseña incorrectos' };
  }

  function adminLogout(){
    clearSession();
    redirectToLogin();
  }

  // Exponer funciones globales
  window.requireAuth = requireAuth;
  window.adminLogin = adminLogin;
  window.adminLogout = adminLogout;
  window.getAdminSession = getSession;
  window.getAdminAuthHeaders = function(){
    const s = getSession();
    const headers = {};
    if (s?.apiToken) headers['Authorization'] = `Bearer ${s.apiToken}`;
    return headers;
  };
})();
