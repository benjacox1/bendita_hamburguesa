// Gestión de Stock de Productos (Backend)

const API_BASE = (window.APP_CONFIG?.API_BASE) || 'http://localhost:4000/api';
let productos = [];

const formProducto = document.getElementById('form-nuevo-producto');
const tbodyStock = document.querySelector('#tabla-stock tbody');
const filtroStock = document.getElementById('filtro-stock');
const btnLimpiarStock = document.getElementById('limpiar-stock');
const btnSyncCatalog = document.getElementById('sync-catalog'); // ya no se usa, pero dejamos referencia por si el HTML lo tiene
if(btnSyncCatalog){ btnSyncCatalog.style.display='none'; }

async function cargarProductos(){
  try {
  const r = await fetch(API_BASE + '/products', { cache:'no-store', headers: { ...(window.getAdminAuthHeaders?.()||{}) } });
    if(!r.ok) throw new Error('HTTP '+r.status);
    productos = await r.json();
  } catch(e){
    console.error('[STOCK] No se pudieron cargar productos:', e);
    productos = [];
  }
}

async function crearProducto(data){
  const body = { nombre: data.nombre, categoria: data.categoria, precio: parseFloat(data.precio||'0'), stock: parseInt(data.stock||'0'), stockMin: parseInt(data.stockMin||'5')||5, descripcion: '', imagen: '' };
  const r = await fetch(API_BASE + '/products', { method:'POST', headers:{'Content-Type':'application/json', ...(window.getAdminAuthHeaders?.()||{})}, body: JSON.stringify(body) });
  if(!r.ok){ const err = await r.json().catch(()=>({error:'Error'})); alert('Error creando producto: '+err.error); return null; }
  return await r.json();
}
async function actualizarProducto(id, patch){
  const r = await fetch(`${API_BASE}/products/${id}`, { method:'PUT', headers:{'Content-Type':'application/json', ...(window.getAdminAuthHeaders?.()||{})}, body: JSON.stringify(patch) });
  if(!r.ok){ alert('Error actualizando producto'); }
}
async function eliminarProducto(id){
  if(!confirm('¿Eliminar producto?')) return;
  const r = await fetch(`${API_BASE}/products/${id}`, { method:'DELETE', headers: { ...(window.getAdminAuthHeaders?.()||{}) } });
  if(!r.ok){ alert('Error eliminando'); return; }
  await cargarProductos();
  renderProductos();
}
async function ajustarStock(id, delta){
  const p = productos.find(x=>x.id===id);
  if(!p) return;
  const nuevoStock = Math.max(0, (p.stock||0) + delta);
  await actualizarProducto(id, { stock: nuevoStock });
  await cargarProductos();
  renderProductos();
}

function estadoStock(p){
  if ((p.stock||0) === 0) return { clase: 'stock-cero', texto: 'Sin stock'};
  if ((p.stock||0) <= (p.stockMin||5)) return { clase: 'stock-bajo', texto: 'Bajo'};
  return { clase: 'stock-ok', texto: 'OK'};
}

function renderProductos(){
  tbodyStock.innerHTML='';
  let filtrado = productos;
  const f = filtroStock.value.trim().toLowerCase();
  if(f){
    filtrado = productos.filter(p =>
      (p.nombre||'').toLowerCase().includes(f) ||
      (p.categoria||'').toLowerCase().includes(f)
    );
  }
  if(!filtrado.length){
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.innerHTML = '<div class="empty-msg">Sin productos cargados.</div>';
    tr.appendChild(td); tbodyStock.appendChild(tr); return;
  }
  filtrado.forEach((p,i)=>{
    const est = estadoStock(p);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${p.imagen?`<img src="${(window.APP_CONFIG?.BACKEND||'http://localhost:4000') + '/imagenes/' + encodeURIComponent((((p.imagen||'').replace(/^\/*/, '')).split('/').pop()))}" alt="${p.nombre}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #29313b"/>`:''}</td>
      <td>${p.nombre}</td>
      <td>${p.categoria||'-'}</td>
      <td>${Number(p.precio||0).toFixed(2)}</td>
      <td>${p.stock||0}</td>
      <td><span class="badge ${est.clase}">${est.texto}</span></td>
      <td class="ajustes"></td>
      <td><button class="danger small" data-del="${p.id}">X</button></td>
    `;
    const ajustes = document.createElement('div');
    ajustes.className = 'adjust-box';
    const btnMenos = document.createElement('button'); btnMenos.textContent='-'; btnMenos.title='Restar 1';
    const btnMas = document.createElement('button'); btnMas.textContent='+'; btnMas.title='Sumar 1';
    const inputDelta = document.createElement('input'); inputDelta.type='number'; inputDelta.value='1'; inputDelta.min='1';
    const btnAplicar = document.createElement('button'); btnAplicar.textContent='Aplicar'; btnAplicar.title='Aplicar cambio personalizado';
    btnMenos.addEventListener('click', ()=> ajustarStock(p.id, -1));
    btnMas.addEventListener('click', ()=> ajustarStock(p.id, +1));
    btnAplicar.addEventListener('click', ()=> {
      const val = parseInt(inputDelta.value||'0');
      if(!val) return;
      ajustarStock(p.id, val);
    });
    ajustes.append(btnMenos, btnMas, inputDelta, btnAplicar);
    tr.querySelector('.ajustes').appendChild(ajustes);
    tbodyStock.appendChild(tr);
  });
  tbodyStock.querySelectorAll('button[data-del]').forEach(b => {
    b.addEventListener('click', ()=> eliminarProducto(b.dataset.del));
  });
}

if(formProducto){
  formProducto.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(formProducto);
    const data = Object.fromEntries(fd.entries());
    const nuevo = await crearProducto(data);
    if(!nuevo) return;
    const file = fd.get('imagen');
    if(file && file.size){
      const up = new FormData();
      up.append('imagen', file);
      const r = await fetch(`${API_BASE}/products/${encodeURIComponent(nuevo.id)}/image`, { method:'POST', headers:{ ...(window.getAdminAuthHeaders?.()||{}) }, body: up });
      if(!r.ok){ const err = await r.json().catch(()=>({error:'Error'})); alert('Subida de imagen falló: '+err.error); }
    }
    formProducto.reset();
    await cargarProductos();
    renderProductos();
  });
}

if(btnLimpiarStock){
  btnLimpiarStock.addEventListener('click', async () => {
    if(!productos.length) return;
    if(!confirm('¿Eliminar todos los productos?')) return;
    // eliminar secuencial (simple)
    for(const p of productos){
  await fetch(`${API_BASE}/products/${p.id}`, { method:'DELETE', headers: { ...(window.getAdminAuthHeaders?.()||{}) } });
    }
    await cargarProductos();
    renderProductos();
  });
}

filtroStock.addEventListener('input', renderProductos);

// Inicial
(async function(){
  await cargarProductos();
  renderProductos();
})();
