(function(){
  const form = document.getElementById('login-form');
  const user = document.getElementById('user');
  const pass = document.getElementById('pass');
  const err = document.getElementById('err');

  function showError(msg){
    err.textContent = msg || 'Error';
    err.style.display = 'block';
  }
  function clearError(){ err.style.display = 'none'; err.textContent=''; }

  function nextUrl(){
    const u = new URL(location.href);
    return u.searchParams.get('next') || './index.html';
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    clearError();
    const u = (user.value||'').trim();
    const p = (pass.value||'').trim();
    const r = (typeof adminLogin === 'function') ? adminLogin(u,p) : { ok:false, error:'Auth no disponible' };
    if(!r.ok){ showError(r.error || 'Credenciales inválidas'); return; }
    // Redirigir
    location.replace(nextUrl());
  });
})();
