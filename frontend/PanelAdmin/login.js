(function(){
  const form = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const user = document.getElementById('user');
  const pass = document.getElementById('pass');
  const err = document.getElementById('err');
  const regUser = document.getElementById('reg-user');
  const regPass = document.getElementById('reg-pass');
  const regMsg = document.getElementById('reg-msg');

  function showError(msg){
    err.textContent = msg || 'Error';
    err.style.display = 'block';
  }
  function clearError(){ err.style.display = 'none'; err.textContent=''; }
  function showRegisterMessage(msg, kind='info'){
    regMsg.textContent = msg || '';
    regMsg.style.display = 'block';
    regMsg.style.background = kind === 'success' ? '#14532d' : '#7f1d1d';
  }

  function nextUrl(){
    const u = new URL(location.href);
    return u.searchParams.get('next') || './index.html';
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    clearError();
    const u = (user.value||'').trim();
    const p = (pass.value||'').trim();
    const r = (typeof adminLogin === 'function') ? await adminLogin(u,p) : { ok:false, error:'Auth no disponible' };
    if(!r.ok){ showError(r.error || 'Credenciales inválidas'); return; }
    if(!r.user?.isAdmin){ showError('Esta cuenta no tiene permisos de administrador'); return; }
    location.replace(nextUrl());
  });

  registerForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const u = (regUser.value||'').trim();
    const p = (regPass.value||'').trim();
    const r = (typeof adminRegister === 'function') ? await adminRegister(u,p) : { ok:false, error:'Registro no disponible' };
    if(!r.ok){ showRegisterMessage(r.error || 'No se pudo crear la cuenta', 'error'); return; }
    showRegisterMessage(r.message || 'Solicitud enviada. Espera aprobación.', 'success');
    regUser.value=''; regPass.value='';
  });
})();
