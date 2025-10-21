// Copia de autenticación para InicioInterfaz/PanelAdmin
(function(){
  const KEY = 'admin_session_v2';
  const EXP_MINUTES = 8 * 60;
  // Credenciales fijas requeridas
  const FIXED_USER = 'benja1906';
  const FIXED_PASS = '1595';
  const DEFAULT_TOKEN = (window.APP_CONFIG && window.APP_CONFIG.ADMIN_TOKEN) || 'bh-admin-2025';
  function nowTs(){ return Date.now(); }
  function addMinutes(ms, mins){ return ms + mins*60*1000; }
  function getSession(){ try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
  function setSession(payload){ localStorage.setItem(KEY, JSON.stringify(payload)); }
  function clearSession(){ localStorage.removeItem(KEY); }
  function isValidSession(sess){ return !!(sess && sess.user && sess.token && sess.exp && nowTs() < sess.exp); }
  function redirectToLogin(){
    const target = location.pathname.replace(/[^/]*$/, '') + 'login.html';
    location.replace(target + '?next=' + encodeURIComponent(location.href));
  }
  function ensureSession(){
    let s = getSession();
    if(isValidSession(s)) { return s; }
    return null;
  }
  function requireAuth(){ const s = ensureSession(); if(!isValidSession(s)) redirectToLogin(); }
  // Validación estricta de usuario/contraseña
  function adminLogin(user, pass){
    const u = (user||'').trim();
    const p = (pass||'').trim();
    if(u !== FIXED_USER || p !== FIXED_PASS){ return { ok:false, error:'Usuario o contraseña incorrecta' }; }
    const exp=addMinutes(nowTs(), EXP_MINUTES);
    const token=btoa(`${u}:${exp}`);
    // Guardamos un token de sesión y un apiToken por si el backend lo requiere en el futuro
    setSession({ user: u, token, apiToken: DEFAULT_TOKEN, exp });
    return {ok:true};
  }
  function adminLogout(){ clearSession(); redirectToLogin(); }
  window.requireAuth=requireAuth; window.adminLogin=adminLogin; window.adminLogout=adminLogout; window.getAdminSession=()=>ensureSession()||getSession(); window.getAdminAuthHeaders=function(){ const s=ensureSession(); const token = (s && s.apiToken) || DEFAULT_TOKEN; const h={}; if(token){ h['Authorization'] = `Bearer ${token}`; } return h; };
})();
