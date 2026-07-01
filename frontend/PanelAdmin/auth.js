// Autenticación real del Panel Admin contra el backend con SQLite.
(function(){
  const KEY = 'admin_session_v2';
  const EXP_MINUTES = 8 * 60;

  function nowTs(){ return Date.now(); }
  function addMinutes(ms, mins){ return ms + mins*60*1000; }
  function getSession(){
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  }
  function setSession(payload){ localStorage.setItem(KEY, JSON.stringify(payload)); }
  function clearSession(){ localStorage.removeItem(KEY); }
  function getApiBase(){
    const configured = window.APP_CONFIG?.API_BASE || window.APP_CONFIG?.BACKEND;
    if (configured) return configured.includes('/api') ? configured : `${configured}/api`;
    return 'http://localhost:4000/api';
  }
  function isValidSession(sess){ return !!(sess && sess.user && sess.token && sess.exp && nowTs() < sess.exp); }
  function redirectToLogin(){
    const target = location.pathname.replace(/[^/]*$/, '') + 'login.html';
    location.replace(target + '?next=' + encodeURIComponent(location.href));
  }
  function ensureSession(){
    let s = getSession();
    if(isValidSession(s)) return s;
    return null;
  }
  function requireAuth(){
    const s = ensureSession();
    if(!isValidSession(s) || !s.isAdmin) redirectToLogin();
  }

  async function adminLogin(user, pass){
    const u = (user||'').trim();
    const p = (pass||'').trim();
    if(!u || !p){ return { ok:false, error:'Completa usuario y contraseña' }; }
    try {
      const response = await fetch(`${getApiBase()}/auth/login`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ username: u, password: p })
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok){ return { ok:false, error:data.error || 'Usuario o contraseña incorrecta' }; }
      const exp = addMinutes(nowTs(), EXP_MINUTES);
      const session = { user: data.user, token: data.token, apiToken: data.token, exp, isAdmin: Boolean(data.user?.isAdmin) };
      setSession(session);
      return { ok:true, user: data.user };
    } catch (e) {
      return { ok:false, error:'No se pudo conectar con el backend' };
    }
  }

  async function adminRegister(user, pass){
    const u = (user||'').trim();
    const p = (pass||'').trim();
    if(!u || !p){ return { ok:false, error:'Completa usuario y contraseña' }; }
    try {
      const response = await fetch(`${getApiBase()}/auth/register`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ username: u, password: p })
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok){ return { ok:false, error:data.error || 'No se pudo crear la cuenta' }; }
      return { ok:true, message: data.message || 'Solicitud enviada' };
    } catch (e) {
      return { ok:false, error:'No se pudo conectar con el backend' };
    }
  }

  function adminLogout(){
    clearSession();
    redirectToLogin();
  }

  window.requireAuth = requireAuth;
  window.adminLogin = adminLogin;
  window.adminRegister = adminRegister;
  window.adminLogout = adminLogout;
  window.getAdminSession = () => ensureSession() || getSession();
  window.getAdminAuthHeaders = function(){
    const s = ensureSession();
    const headers = {};
    if (s?.apiToken) headers['Authorization'] = `Bearer ${s.apiToken}`;
    return headers;
  };
})();
