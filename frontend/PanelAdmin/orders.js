// Gestión de Pedidos (Backend)
// Estados: espera -> preparando -> listo -> retirado
// Ahora consume API REST en lugar de localStorage

const API_BASE = (window.APP_CONFIG?.API_BASE) || 'http://localhost:4000/api';
let pedidos = [];
let pedidosPreviosMap = new Map(); // para detectar cambios en paymentStatus

const formPedido = document.getElementById('form-nuevo-pedido');
const tbodyPedidos = document.querySelector('#tabla-pedidos tbody');
const filtroPedidos = document.getElementById('filtro-pedidos');
const btnLimpiarPedidos = document.getElementById('limpiar-pedidos');
const btnRefrescar = document.getElementById('refrescar-pedidos');

const estadosSecuenciales = ['espera','preparando','listo','retirado'];
const etiquetasEstado = {
  espera: 'En Espera',
  preparando: 'Preparándose',
  listo: 'Listo para Retirar',
  retirado: 'Retirado'
};

async function cargarPedidos(){
  try {
    const r = await fetch(API_BASE + '/orders', { cache:'no-store' });
    if(!r.ok) throw new Error('HTTP '+r.status);
    pedidos = await r.json();
  } catch(e){
    console.error('[PEDIDOS] No se pudieron cargar pedidos:', e);
    pedidos = [];
  }
}

async function crearPedidoManual(data){
  // Para mantener compatibilidad, creamos un pedido con 1 item artificial si no se especifica
  // Lo ideal es tener un selector de producto. Aquí usamos un productId ficticio imposible de descontar (backend lo rechazará si no existe)
  if(!data.productId){
    alert('Para crear pedidos manuales necesitas un productId válido (adapta el formulario).');
    return;
  }
  const body = {
    cliente: data.cliente || '',
    items: [{ productId: data.productId, cantidad: data.cantidad || 1 }]
  };
  const r = await fetch(API_BASE + '/orders', {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  if(!r.ok){
    const err = await r.json().catch(()=>({error:'Error'}));
    alert('Error creando pedido: ' + err.error);
    return;
  }
  await cargarPedidos();
  renderPedidos();
}

async function cambiarEstado(id, nuevo){
  const r = await fetch(`${API_BASE}/orders/${id}/state`, {
    method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ estado: nuevo })
  });
  if(!r.ok){ alert('Error cambiando estado'); return; }
  await cargarPedidos();
  renderPedidos();
}

async function eliminarPedido(id){
  if(!confirm('Eliminar pedido?')) return;
  const r = await fetch(`${API_BASE}/orders/${id}`, { method:'DELETE' });
  if(!r.ok){ alert('Error eliminando'); return; }
  await cargarPedidos();
  renderPedidos();
}

function crearBotonesEstados(p) {
  const cont = document.createElement('div');
  cont.className = 'acciones';
  estadosSecuenciales.forEach(est => {
    const b = document.createElement('button');
    b.textContent = etiquetasEstado[est].split(' ')[0];
    b.title = etiquetasEstado[est];
    if (p.estado === est) b.classList.add('active');
    b.addEventListener('click', () => cambiarEstado(p.id, est));
    cont.appendChild(b);
  });
  return cont;
}

function renderPedidos() {
  tbodyPedidos.innerHTML='';
  let filtrado = pedidos;
  const f = filtroPedidos.value.trim().toLowerCase();
  if (f) {
    filtrado = pedidos.filter(p=>
      (p.cliente||'').toLowerCase().includes(f) ||
      p.items?.some(it => (it.nombre||'').toLowerCase().includes(f))
    );
  }
  if (!filtrado.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.innerHTML = '<div class="empty-msg">Sin pedidos por el momento.</div>';
    tr.appendChild(td); tbodyPedidos.appendChild(tr); return;
  }

  filtrado.forEach((p, i) => {
    const listaItems = (p.items||[]).map(it => `${it.nombre||it.productId} x${it.cantidad}`).join('<br>');
    const tr = document.createElement('tr');
    const pay = p.paymentStatus || 'pending';
    const payColor = pay === 'approved' ? '#2ecc71' : (pay === 'rejected' ? '#e74c3c' : '#f1c40f');
    const previo = pedidosPreviosMap.get(p.id);
    const changed = previo && previo !== pay;
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${p.cliente||''}</td>
      <td>${listaItems}</td>
      <td>${(p.importe||0).toFixed(2)}</td>
      <td><span class="badge ${p.estado}">${etiquetasEstado[p.estado]||p.estado}</span></td>
      <td><span class="badge badge-pay" data-pay="${pay}" style="background:${payColor};color:#111;font-weight:600;">${pay}</span></td>
      <td class="td-acciones"></td>
      <td>${new Date(p.fechaCreacion).toLocaleTimeString()}</td>
      <td><button class="danger small" data-del="${p.id}">X</button></td>
    `;
    if(changed){
      tr.classList.add('pay-changed');
      setTimeout(()=> tr.classList.remove('pay-changed'), 4000);
    }
    pedidosPreviosMap.set(p.id, pay);
    tbodyPedidos.appendChild(tr);
    tr.querySelector('.td-acciones').appendChild(crearBotonesEstados(p));
  });

  tbodyPedidos.querySelectorAll('button[data-del]').forEach(btn => {
    btn.addEventListener('click', () => eliminarPedido(btn.dataset.del));
  });

  updateDebug();
}

// Formulario manual (requiere adaptar HTML para incluir productId y cantidad)
if(formPedido){
  formPedido.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formPedido).entries());
    data.cantidad = parseInt(data.cantidad||'1');
    await crearPedidoManual(data);
    formPedido.reset();
  });
}

if (btnLimpiarPedidos) {
  btnLimpiarPedidos.addEventListener('click', async () => {
    if(!pedidos.length) return;
    if(!confirm('Eliminar TODOS los pedidos?')) return;
    // Eliminar uno por uno (sencillo); para optimizar crear endpoint bulk
    for(const p of pedidos){
      await fetch(`${API_BASE}/orders/${p.id}`, { method:'DELETE' });
    }
    await cargarPedidos();
    renderPedidos();
  });
}
if (btnRefrescar) btnRefrescar.addEventListener('click', async () => { await cargarPedidos(); renderPedidos(); });

// ================= Debug Panel Adaptado =================
const debugToggle = document.getElementById('debug-toggle');
const debugPanel = document.getElementById('debug-panel');
const debugJson = document.getElementById('debug-json');
const debugCerrar = document.getElementById('debug-cerrar');
const debugRecargar = document.getElementById('debug-recargar');
const debugCopiar = document.getElementById('debug-copiar');
const debugTest = document.getElementById('debug-test');
const debugExport = document.getElementById('debug-export');
const debugDelTest = document.getElementById('debug-deltest');

function updateDebug(){
  if(!debugPanel || debugPanel.hidden) return; 
  try { debugJson.textContent = JSON.stringify(pedidos, null, 2); } catch(e){ debugJson.textContent = 'Error serializando: '+e.message; }
}
function toggleDebug(force){
  if(!debugPanel) return;
  if(typeof force === 'boolean') debugPanel.hidden = !force; else debugPanel.hidden = !debugPanel.hidden;
  updateDebug();
}
if (debugToggle) debugToggle.addEventListener('click', () => toggleDebug());
if (debugCerrar) debugCerrar.addEventListener('click', () => toggleDebug(false));
if (debugRecargar) debugRecargar.addEventListener('click', async () => { await cargarPedidos(); renderPedidos(); });
if (debugCopiar) debugCopiar.addEventListener('click', () => {
  try { navigator.clipboard.writeText(JSON.stringify(pedidos, null, 2)); debugCopiar.textContent='Copiado'; setTimeout(()=>debugCopiar.textContent='Copiar JSON',1500);} catch(e){ alert('No se pudo copiar'); }
});

if (debugTest) debugTest.addEventListener('click', async () => {
  // Crear pedido de prueba (requiere productId real; tomamos el primero disponible)
  let firstProductId = null;
  try {
    const prods = await fetch(API_BASE + '/products').then(r=>r.json()).catch(()=>[]);
    if(prods.length) firstProductId = prods[0].id;
  } catch{}
  if(!firstProductId){ alert('No hay productos para generar pedido de prueba'); return; }
  const body = { cliente: 'Test '+new Date().toLocaleTimeString(), items:[{ productId:firstProductId, cantidad:1 }]};
  const r = await fetch(API_BASE + '/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if(!r.ok){ alert('Error creando pedido test'); return; }
  await cargarPedidos();
  renderPedidos();
  toggleDebug(true);
});

if (debugDelTest) debugDelTest.addEventListener('click', async () => {
  // Borrar pedidos cuyo cliente empiece con 'Test '
  const testIds = pedidos.filter(p => /^Test /.test(p.cliente||'')).map(p=>p.id);
  for(const id of testIds){ await fetch(`${API_BASE}/orders/${id}`, { method:'DELETE' }); }
  await cargarPedidos();
  renderPedidos();
  toggleDebug(true);
  if(!testIds.length) alert('No había pedidos de prueba');
});

if (debugExport) debugExport.addEventListener('click', () => {
  exportPedidosCSV();
});

function exportPedidosCSV(){
  if(!pedidos.length){ alert('No hay pedidos para exportar'); return; }
  const encabezados = ['id','cliente','estado','importe','fechaCreacion'];
  const filas = pedidos.map(p => encabezados.map(k => sanitizeCSV(p[k])));
  const csv = [encabezados.join(','), ...filas.map(f=>f.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pedidos_'+ new Date().toISOString().replace(/[:T]/g,'-').split('.')[0] + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
}
function sanitizeCSV(val){
  if(val === null || val === undefined) return '';
  let s = String(val);
  if(/[",\n]/.test(s)) s = '"' + s.replace(/"/g,'""') + '"';
  return s;
}

// Inicial
(async function initAdmin(){
  await cargarPedidos();
  renderPedidos();
  // Polling cada 10s
  setInterval(async ()=>{
    const old = new Map(pedidosPreviosMap); // copia para comparar
    await cargarPedidos();
    renderPedidos();
    // (La comparación se hace dentro de renderPedidos con pedidosPreviosMap)
  }, 10000);
})();
