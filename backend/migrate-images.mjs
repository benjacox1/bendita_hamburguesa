// Migra imágenes desde la carpeta legacy con espacios a la carpeta nueva usada por el servidor optimizado
// Uso: node migrate-images.mjs  (o npm run migrate-images si agregas script)
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEGACY_DIR = path.join(__dirname, '..', 'InicioInterfaz', 'detalle de los productos', 'IMAGENES COMIDA');
const TARGET_DIR = path.join(__dirname, '..', 'InicioInterfaz', 'detalle-productos', 'IMAGENES COMIDA');

async function ensureDir(p){ await fs.mkdir(p, { recursive: true }); }

async function migrate(){
  console.log('Migrando imágenes de:\n  LEGACY:', LEGACY_DIR, '\n  TARGET:', TARGET_DIR);
  try { await fs.access(LEGACY_DIR); } catch { console.log('No existe carpeta legacy, nada que migrar'); return; }
  await ensureDir(TARGET_DIR);
  const files = await fs.readdir(LEGACY_DIR);
  let moved = 0, skipped = 0;
  for(const f of files){
    if(!f.toLowerCase().endsWith('.png')) { skipped++; continue; }
    const src = path.join(LEGACY_DIR, f);
    const dest = path.join(TARGET_DIR, f);
    try {
      await fs.access(dest);
      console.log('[SKIP] ya existe', f);
      skipped++;
    } catch {
      await fs.copyFile(src, dest);
      console.log('[COPY]', f);
      moved++;
    }
  }
  console.log('Resultado migración -> Copiados:', moved, 'Omitidos:', skipped);
}

migrate();