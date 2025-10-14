// Servidor estático ultra simple para la carpeta InicioInterfaz
// Uso: node frontend-server.js (opcional PORT=5173)

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

const FRONT_DIR = path.join(__dirname, 'InicioInterfaz');

app.use((req,res,next)=>{
  res.setHeader('Cache-Control','public, max-age=60');
  next();
});

app.use(express.static(FRONT_DIR, { extensions:['html'] }));

app.get('/health', (req,res)=>res.json({ ok:true, ts:Date.now() }));

app.use((req,res)=>{
  res.status(404).send('No encontrado');
});

app.listen(PORT, ()=>{
  console.log(`[FRONT] Sirviendo ${FRONT_DIR} en http://localhost:${PORT}`);
});
