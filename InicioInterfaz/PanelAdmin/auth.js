// Copia de autenticación para InicioInterfaz/PanelAdmin
(function(){
  const KEY = 'admin_session_v2';
  const EXP_MINUTES = 8 * 60;
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
  function requireAuth(){ const s = getSession(); if(!isValidSession(s)) redirectToLogin(); }
  // Uso de token en lugar de credenciales fijas: el campo "contraseña" se toma como token de acceso
  function adminLogin(user, pass){
    const accessToken = (pass || '').trim();
    if(!accessToken){ return { ok:false, error:'Ingrese su clave de acceso' }; }
    const exp=addMinutes(nowTs(), EXP_MINUTES);
    const token=btoa(`${user||'admin'}:${exp}`);
    setSession({user: user||'admin', token, apiToken: accessToken, exp});
    return {ok:true};
  }
  function adminLogout(){ clearSession(); redirectToLogin(); }
  window.requireAuth=requireAuth; window.adminLogin=adminLogin; window.adminLogout=adminLogout; window.getAdminSession=getSession; window.getAdminAuthHeaders=function(){ const s=getSession(); const h={}; if(s?.apiToken){ h['Authorization'] = `Bearer ${s.apiToken}`; } return h; };
})();
