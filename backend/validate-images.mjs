// Script de validación de imágenes y variantes
// Uso: npm run validate-images
// - Comprueba que cada imagen referenciada en products.json existe
// - Verifica que exista .webp y .avif correspondientes
// - Verifica placeholders.json y que contenga claves para cada imagen

import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PRODUCTS = path.join(__dirname, 'data', 'products.json');
const IMG_DIR = path.join(__dirname, '..', 'InicioInterfaz', 'detalle-productos', 'IMAGENES COMIDA');
const PLACEHOLDERS = path.join(IMG_DIR, 'placeholders.json');

function fail(msg){ console.error('❌', msg); }
function ok(msg){ console.log('✅', msg); }

async function main(){
  let errors = 0;
  let products = [];
  try { products = JSON.parse(await fs.readFile(DATA_PRODUCTS, 'utf8')); ok('products.json leído'); } catch(e){ fail('No se pudo leer products.json: '+e.message); process.exit(1); }
  let ph = {};
  try { ph = JSON.parse(await fs.readFile(PLACEHOLDERS, 'utf8')); ok('placeholders.json leído'); } catch(e){ fail('No se pudo leer placeholders.json (ejecuta optimize-images primero): '+e.message); errors++; }

  for(const p of products){
    const imgRel = (p.imagen || '').replace(/^\/+/, '');
    if(!imgRel){ fail(`Producto ${p.id} sin campo imagen`); errors++; continue; }
    const baseName = imgRel.split('/').pop();
    const orig = path.join(IMG_DIR, baseName);
    try { await fs.access(orig); ok(`Original OK: ${baseName}`); } catch { fail(`Falta original: ${baseName}`); errors++; continue; }
    const webp = path.join(IMG_DIR, baseName.replace(/\.[^.]+$/, '.webp'));
    const avif = path.join(IMG_DIR, baseName.replace(/\.[^.]+$/, '.avif'));
    try { await fs.access(webp); ok(`WebP OK: ${path.basename(webp)}`);} catch { fail(`Falta WebP: ${path.basename(webp)}`); errors++; }
    try { await fs.access(avif); ok(`AVIF OK: ${path.basename(avif)}`);} catch { fail(`Falta AVIF: ${path.basename(avif)}`); errors++; }
    if(ph && !ph[baseName]){ fail(`Placeholder faltante para ${baseName}`); errors++; } else if(ph[baseName]) { ok(`Placeholder OK: ${baseName}`); }
  }

  if(errors){
    console.error(`\nResultado: ${errors} problema(s) encontrado(s).`);
    process.exit(2);
  } else {
    console.log('\nResultado: todo OK');
  }
}

main();
