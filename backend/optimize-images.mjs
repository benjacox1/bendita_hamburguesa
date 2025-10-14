// Script para generar variantes WebP y AVIF optimizadas + placeholders blur (base64)
// Uso: npm run optimize-images
// Requisitos: carpeta de origen con PNG/JPG ubicada en ../InicioInterfaz/detalle-productos/IMAGENES COMIDA
// Produce archivos .webp, .avif y un placeholders.json (no sobrescribe originales).

import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '..', 'InicioInterfaz', 'detalle-productos', 'IMAGENES COMIDA');

async function ensureDir(p){ await fs.mkdir(p, { recursive: true }); }

async function processImage(file){
  const full = path.join(SRC_DIR, file);
  const ext = path.extname(file).toLowerCase();
  if(!['.png', '.jpg', '.jpeg'].includes(ext)) return false;
  const base = file.substring(0, file.length - ext.length);
  const targetWebp = path.join(SRC_DIR, base + '.webp');
  const targetAvif = path.join(SRC_DIR, base + '.avif');
  try {
    const stOrig = await fs.stat(full).catch(()=>null);
    const stWebp = await fs.stat(targetWebp).catch(()=>null);
    const stAvif = await fs.stat(targetAvif).catch(()=>null);

    const needWebp = !stWebp || (stOrig && stWebp.mtimeMs < stOrig.mtimeMs);
    const needAvif = !stAvif || (stOrig && stAvif.mtimeMs < stOrig.mtimeMs);

    if(needWebp){
      await sharp(full)
        .resize({ width: 1000, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(targetWebp);
      console.log('[WEBP]', file, '->', path.basename(targetWebp));
    } else {
      console.log('[SKIP WEBP]', file);
    }
    if(needAvif){
      await sharp(full)
        .resize({ width: 1000, withoutEnlargement: true })
        .avif({ quality: 50 })
        .toFile(targetAvif);
      console.log('[AVIF]', file, '->', path.basename(targetAvif));
    } else {
      console.log('[SKIP AVIF]', file);
    }
    return true;
  } catch(e){
    console.error('[ERROR]', file, e.message);
    return false;
  }
}

async function run(){
  console.log('Optimizando imágenes en', SRC_DIR);
  try {
    await ensureDir(SRC_DIR);
    const files = await fs.readdir(SRC_DIR);
    let ok = 0; let fail = 0; let skipped = 0;
    const placeholders = {};
    for(const f of files){
      const res = await processImage(f);
      if(res === true) ok++; else if(res === false) fail++; else skipped++;
      // Generar placeholder (blur) sólo para imágenes base
      const ext = path.extname(f).toLowerCase();
      if(['.png', '.jpg', '.jpeg'].includes(ext)){
        try {
          const full = path.join(SRC_DIR, f);
            const buf = await sharp(full)
              .resize({ width: 32 })
              .webp({ quality: 40 })
              .toBuffer();
            const b64 = 'data:image/webp;base64,' + buf.toString('base64');
            const key = f; // se usará el mismo nombre que aparece en products.json (nombre original)
            placeholders[key] = b64;
        } catch(e){
          console.warn('[PLACEHOLDER FAIL]', f, e.message);
        }
      }
    }
    // Escribir placeholders.json
    const outFile = path.join(SRC_DIR, 'placeholders.json');
    await fs.writeFile(outFile, JSON.stringify(placeholders, null, 2), 'utf8');
    console.log('[PLACEHOLDERS] generado', Object.keys(placeholders).length, 'entradas');
    console.log('Completado. OK:', ok, 'FAIL:', fail, 'SKIPPED:', skipped);
  } catch(e){
    console.error('No se pudieron procesar las imágenes:', e.message);
    process.exit(1);
  }
}

run();
