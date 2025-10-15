// Versión migrada (sin espacios en la ruta) del detalle de producto
const BACKEND = (window.APP_CONFIG?.BACKEND) || 'http://localhost:4000';
let modoFallback = false;
const LS_CARRITO = 'carrito_items_v1';
const CART_COUNT_ID = 'cart-count-det';
const MINI_ID = 'cart-mini';
function apiBase(){ return (window.APP_CONFIG?.API_BASE) || (BACKEND + '/api'); }
function getParamId(){ const u = new URL(location.href); return u.searchParams.get('id'); }
function formatearPrecio(p){ return '$ ' + Number(p).toFixed(2); }
async function fetchProducto(id){
  const base = apiBase();
  try {
    const url = `${base}/products/${encodeURIComponent(id)}`;
    const r = await fetch(url, { cache:'no-store' });
    if(r.status === 404) return null;
    if(!r.ok) throw new Error('HTTP '+r.status+' al solicitar '+url);
    return await r.json();
  } catch(e){
    console.warn('[DETALLE] Error backend producto individual, fallback listado local:', e.message);
    modoFallback = true;
    // Fallback: cargar listado local y extraer producto
    const rLocal = await fetch('productos.json?_=' + Date.now());
    if(!rLocal.ok) throw new Error('No se pudo cargar productos.json');
    const arr = await rLocal.json();
    return arr.find(p=>p.id === id) || null;
  }
}
function leerCarrito(){ try { return JSON.parse(localStorage.getItem(LS_CARRITO)) || []; } catch { return []; } }
function guardarCarrito(arr){ localStorage.setItem(LS_CARRITO, JSON.stringify(arr)); }
function agregarAlCarrito(producto, cantidad){
  const lista = leerCarrito();
  const idx = lista.findIndex(i => i.id === producto.id);
  if(idx !== -1){ lista[idx].cantidad += cantidad; }
  else { lista.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad, imagen: producto.imagen }); }
  guardarCarrito(lista); return lista;
}
function actualizarContador(){
  try {
    const items = leerCarrito();
    const total = items.reduce((acc,i)=> acc + (Number(i.cantidad)||0), 0);
    const el = document.getElementById(CART_COUNT_ID);
    if(el){
      el.textContent = total;
      el.classList.remove('bump');
      void el.offsetWidth; // restart animation
      el.classList.add('bump');
    }
  } catch {}
}

function renderMiniCart(){
  const panel = document.getElementById(MINI_ID);
  if(!panel) return;
  const items = leerCarrito();
  const total = items.reduce((acc,i)=> acc + (Number(i.precio)*Number(i.cantidad)||0), 0);
  const rows = items.slice(0,6).map(i=> `
    <div class="item">
  <img src="${(window.APP_CONFIG?.BACKEND||'http://localhost:4000') + '/imagenes/' + encodeURIComponent(((i.imagen||'').replace(/^\/*/, '').split('/').pop()))}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #29313b" alt="${i.nombre}">
      <div>
        <div class="name">${i.nombre}</div>
        <div class="meta">${i.cantidad} × $ ${Number(i.precio).toFixed(2)}</div>
      </div>
    </div>
  `).join('');
  panel.innerHTML = `
    <header>
      <strong>Tu carrito</strong>
      <button id="mini-close">✕</button>
    </header>
    <div class="items">${rows || '<div class="item"><div class="name">Carrito vacío</div></div>'}</div>
    <div class="footer">
      <span>Total: $ ${total.toFixed(2)}</span>
      <a class="go" href="../Carrito de compras/carrito.html">Ir al carrito</a>
    </div>
  `;
  panel.querySelector('#mini-close')?.addEventListener('click', ()=> toggleMiniCart(false));
}

function toggleMiniCart(force){
  const panel = document.getElementById(MINI_ID);
  if(!panel) return;
  const show = force !== undefined ? force : !panel.classList.contains('show');
  if(show){ renderMiniCart(); panel.classList.add('show'); }
  else { panel.classList.remove('show'); }
}
async function init(){
  const cont = document.getElementById('contenedor');
  const estado = document.getElementById('estado-carga');
  const errorBox = document.getElementById('error-box');
  const id = getParamId();
  if(!id){ estado.textContent = 'Falta el parámetro ?id='; return; }
  try {
  console.log('[DETALLE] init() id=', id);
  const prod = await fetchProducto(id);
    if(!prod){ estado.textContent = 'Producto no encontrado.'; return; }
    estado.remove();
    const tpl = document.getElementById('tpl-producto');
    const node = tpl.content.cloneNode(true);
    const imgEl = node.getElementById('prod-imagen');
    const thumbsEl = node.getElementById('galeria-thumbs');
    const zoomBtn = node.getElementById('btn-zoom');
    const zoomOverlay = document.getElementById('zoom-overlay');
    const zoomStage = document.getElementById('zoom-stage');
    const zoomImg = document.getElementById('zoom-img');
    const zoomClose = document.getElementById('zoom-close');
    const imgPath = (prod.imagen || '').replace(/^\/*/, '');
    const fileName = imgPath.split('/').pop();
    const v = (window.APP_CONFIG?.ASSET_VERSION ?? 1);
  const finalSrc = (window.APP_CONFIG?.BACKEND || 'http://localhost:4000') + '/imagenes/' + encodeURIComponent(fileName) + '?v=' + v;
    console.log('[DETALLE] Render producto', { id: prod.id, finalSrc, modoFallback });
    const pre = new Image(); pre.src = finalSrc;
    try {
  const phResp = await fetch(((window.APP_CONFIG?.BACKEND || 'http://localhost:4000') + '/imagenes/placeholders.json?_=' + Date.now()));
      if(phResp.ok){
        const ph = await phResp.json();
        const placeholder = ph[fileName];
        imgEl.loading = 'lazy';
        imgEl.classList.add('blur-up');
        if(placeholder){
          imgEl.style.backgroundImage = `url(${placeholder})`;
          imgEl.style.backgroundSize = 'cover';
          imgEl.style.backgroundPosition = 'center';
        }
      }
    } catch {}
    imgEl.src = finalSrc;
    imgEl.addEventListener('load', ()=>{
      imgEl.classList.add('is-loaded');
      setTimeout(()=>{ imgEl.style.backgroundImage=''; }, 400);
    }, { once: true });
  imgEl.alt = prod.nombre;
  // ===== Galería mínima =====
  thumbsEl.innerHTML='';
  const unicoBtn=document.createElement('button'); unicoBtn.className='active';
  const tImg=document.createElement('img'); tImg.alt=prod.nombre; tImg.src=finalSrc; unicoBtn.appendChild(tImg); thumbsEl.appendChild(unicoBtn);

  // ===== Zoom =====
  let scale=1,minScale=1,maxScale=4; let originX=0,originY=0,startX=0,startY=0,isPanning=false;
  function applyTransform(){ zoomImg.style.transform=`translate(${originX}px, ${originY}px) scale(${scale})`; }
  function constrain(){ const rect=zoomStage.getBoundingClientRect(); const w=zoomImg.naturalWidth*scale; const h=zoomImg.naturalHeight*scale; const maxX=Math.max(0,(w-rect.width)/2); const maxY=Math.max(0,(h-rect.height)/2); originX=Math.min(maxX, Math.max(-maxX, originX)); originY=Math.min(maxY, Math.max(-maxY, originY)); }
  function resetZoom(){ scale=1; originX=0; originY=0; applyTransform(); }
  function openZoom(){ zoomImg.src=imgEl.src; resetZoom(); zoomOverlay.classList.add('is-open'); }
  function closeZoom(){ zoomOverlay.classList.remove('is-open'); setTimeout(()=>{ zoomImg.src=''; },200); }
  zoomBtn.addEventListener('click', openZoom); zoomClose.addEventListener('click', closeZoom); zoomOverlay.addEventListener('click', e=>{ if(e.target===zoomOverlay) closeZoom(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && zoomOverlay.classList.contains('is-open')) closeZoom(); });
  zoomStage.addEventListener('wheel', e=>{ if(!zoomOverlay.classList.contains('is-open')) return; e.preventDefault(); const rect=zoomStage.getBoundingClientRect(); const offsetX=e.clientX-rect.left-rect.width/2-originX; const offsetY=e.clientY-rect.top-rect.height/2-originY; const delta=-Math.sign(e.deltaY)*0.15; const newScale=Math.min(maxScale, Math.max(minScale, scale+delta)); if(newScale!==scale){ const ratio=newScale/scale; originX-=offsetX*(ratio-1); originY-=offsetY*(ratio-1); scale=newScale; constrain(); applyTransform(); } }, { passive:false });
  zoomStage.addEventListener('pointerdown', e=>{ if(!zoomOverlay.classList.contains('is-open')) return; isPanning=true; startX=e.clientX-originX; startY=e.clientY-originY; zoomStage.setPointerCapture(e.pointerId); });
  zoomStage.addEventListener('pointermove', e=>{ if(!isPanning) return; originX=e.clientX-startX; originY=e.clientY-startY; constrain(); applyTransform(); });
  ['pointerup','pointerleave'].forEach(ev=>zoomStage.addEventListener(ev, ()=>{ isPanning=false; }));
  zoomStage.addEventListener('dblclick', ()=>{ scale=(scale===1?2:1); if(scale===1){originX=0;originY=0;} constrain(); applyTransform(); });
  let pinchDist=0,pinchStartScale=1; zoomStage.addEventListener('touchstart', e=>{ if(e.touches.length===2){ pinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); pinchStartScale=scale; } }, { passive:true });
  zoomStage.addEventListener('touchmove', e=>{ if(e.touches.length===2){ e.preventDefault(); const nd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); const diff=nd/pinchDist; scale=Math.min(maxScale, Math.max(minScale, pinchStartScale*diff)); constrain(); applyTransform(); } }, { passive:false });
    node.getElementById('prod-nombre').textContent = prod.nombre;
    node.getElementById('prod-descripcion').textContent = prod.descripcion || '';
    node.getElementById('prod-precio').textContent = formatearPrecio(prod.precio);
    node.getElementById('prod-categoria').textContent = prod.categoria;
    document.getElementById('titulo-prod').textContent = prod.nombre + (modoFallback? ' (solo lectura)' : '');
    cont.appendChild(node);
    const form = document.getElementById('form-agregar');
    const resultado = document.getElementById('resultado');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const datos = Object.fromEntries(new FormData(form).entries());
      const cantidad = parseInt(datos.cantidad || '1');
      if(cantidad <= 0){ resultado.textContent = 'Cantidad inválida'; resultado.classList.add('error'); return; }
      resultado.classList.remove('error');
      agregarAlCarrito(prod, cantidad);
      resultado.textContent = 'Agregado al carrito ('+cantidad+')';
      actualizarContador();
      toggleMiniCart(true);
      form.reset();
    });
    actualizarContador();
    // toggle desde el botón del header en detalle
    document.getElementById('btn-cart-det')?.addEventListener('click', (e)=>{ e.preventDefault(); toggleMiniCart(); });
    // cerrar con click afuera / ESC
    document.addEventListener('click', (e)=>{
      const mini = document.getElementById(MINI_ID);
      if(!mini || !mini.classList.contains('show')) return;
      const isInside = mini.contains(e.target) || e.target.closest('#btn-cart-det');
      if(!isInside) toggleMiniCart(false);
    });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') toggleMiniCart(false); });
  } catch(err){
    console.error('[DETALLE] Error general init()', err);
    estado.style.display='none';
    errorBox.style.display='block';
    errorBox.textContent = 'Error cargando datos: ' + err.message;
  }
}
init();
