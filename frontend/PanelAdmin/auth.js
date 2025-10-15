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
    if(!sess || !sess.apiToken || !sess.exp) return false;
    return nowTs() < sess.exp;
  }

  function redirectToLogin(){
    const target = location.pathname.replace(/[^/]*$/, '') + 'login.html';
    location.replace(target + '?next=' + encodeURIComponent(location.href));
  }

  function requireAuth(){
    const s = getSession();
    if(!isValidSession(s)) redirectToLogin();
  }

  // Login sin hardcodear usuario/contraseña: la "contraseña" se usa como token de acceso (ADMIN_TOKEN)
  function adminLogin(user, pass){
    const accessToken = (pass || '').trim();
    if(!accessToken){
      return { ok: false, error: 'Ingrese su clave de acceso' };
    }
    const exp = addMinutes(nowTs(), EXP_MINUTES);
    const token = btoa(`${user || 'admin'}:${exp}`);
    setSession({ user: user || 'admin', token, apiToken: accessToken, exp });
    return { ok: true };
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
