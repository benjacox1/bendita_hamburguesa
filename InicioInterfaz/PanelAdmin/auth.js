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
  function adminLogin(user, pass){ const FIXED_USER='benja1906'; const FIXED_PASS='1595'; if(user===FIXED_USER && pass===FIXED_PASS){ const exp=addMinutes(nowTs(), EXP_MINUTES); const apiToken='bh-admin-2025'; const token=btoa(`${user}:${exp}`); setSession({user, token, apiToken, exp}); return {ok:true}; } return {ok:false, error:'Usuario o contraseña incorrectos'}; }
  function adminLogout(){ clearSession(); redirectToLogin(); }
  window.requireAuth=requireAuth; window.adminLogin=adminLogin; window.adminLogout=adminLogout; window.getAdminSession=getSession; window.getAdminAuthHeaders=function(){ const s=getSession(); const h={}; if(s?.apiToken){ h['Authorization'] = `Bearer ${s.apiToken}`; } return h; };
})();
