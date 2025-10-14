# 🌐 GUÍA: PÁGINA PÚBLICA CON URL ESTABLE

## 🆓 **OPCIÓN 1: HOSTING GRATUITO (RECOMENDADO)**

### **GitHub + Netlify/Vercel**

#### **Paso 1: Subir a GitHub**
```bash
# En tu carpeta del proyecto
git init
git add .
git commit -m "Initial commit - Bendita Hamburguesa App"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/bendita-hamburguesa.git
git push -u origin main
```

#### **Paso 2: Configurar para Hosting**

**📁 Estructura recomendada:**
```
bendita-hamburguesa/
├── frontend/          # Tu carpeta InicioInterfaz
├── backend/           # API en Node.js
├── .gitignore
├── README.md
├── package.json       # Para el deploy
└── netlify.toml       # Configuración
```

**📝 Crear `netlify.toml`:**
```toml
[build]
  publish = "frontend"
  command = "npm run build"

[context.production.environment]
  NODE_ENV = "production"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### **Paso 3: Deploy Automático**

**🚀 En Netlify:**
1. Conecta tu repositorio GitHub
2. Configura build settings:
   - Build command: `npm run build`
   - Publish directory: `frontend`
3. ¡Deploy automático en cada push!

**URL resultante:** `https://bendita-hamburguesa.netlify.app`

---

## 💰 **OPCIÓN 2: HOSTING PREMIUM CON BACKEND**

### **Railway.app (Fácil para Node.js)**
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Deploy directo desde GitHub
railway login
railway init
railway up
```
**URL:** `https://tu-app.railway.app`

### **Render.com (Gratuito con limitaciones)**
1. Conecta GitHub repo
2. Configura como Web Service
3. Build: `npm install`
4. Start: `npm start`

**URL:** `https://bendita-hamburguesa.onrender.com`

### **Heroku (Popular pero de pago)**
```bash
# Heroku CLI
heroku create bendita-hamburguesa
git push heroku main
```

---

## 🎯 **CONFIGURACIÓN PARA PRODUCCIÓN**

### **Variables de Entorno (.env.production)**
```env
NODE_ENV=production
PORT=443
MP_ACCESS_TOKEN=APP_USR-PRODUCCION-TOKEN
MP_WEBHOOK=https://tu-dominio.com/webhooks/mercadopago
FRONTEND_URL=https://tu-dominio.com
DATABASE_URL=mongodb://production-db
```

### **Dominio Personalizado (Opcional)**
- 💳 Comprar dominio: `benditahamburguesa.com` (~$12/año)
- 🔗 Configurar DNS en Netlify/Vercel
- 🔒 SSL automático incluido

---

## 📦 **PREPARAR PARA DEPLOY**

### **1. Separar Frontend y Backend**

**Frontend (Static):**
```json
{
  "name": "bendita-hamburguesa-frontend",
  "scripts": {
    "build": "cp -r InicioInterfaz/* ./dist/",
    "serve": "serve dist"
  }
}
```

**Backend (API):**
```json
{
  "name": "bendita-hamburguesa-api", 
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### **2. Configurar CORS para Producción**
```javascript
// En server.js
const allowedOrigins = [
  'http://localhost:3000',
  'https://bendita-hamburguesa.netlify.app',
  'https://tu-dominio-personalizado.com'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

### **3. Base de Datos en la Nube**

**MongoDB Atlas (Gratuito):**
```javascript
// Reemplazar archivos JSON
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);
```

---

## 🚀 **ARQUITECTURA DE PRODUCCIÓN RECOMENDADA**

```
Frontend (Netlify/Vercel)
    ↓ API calls
Backend API (Railway/Render) 
    ↓ Database
MongoDB Atlas (Cloud DB)
    ↓ Payments
MercadoPago API
    ↓ Storage
Cloudinary (Imágenes)
```

**Ventajas:**
- ✅ **Escalable** automáticamente
- ✅ **SSL** incluido
- ✅ **CDN** global
- ✅ **Backup** automático
- ✅ **99.9%** uptime
- ✅ **URL estable**

---

## 💰 **COSTOS ESTIMADOS**

### **Opción Gratuita Total:**
- GitHub: Gratis
- Netlify/Vercel: Gratis (límites generosos)
- MongoDB Atlas: Gratis (512MB)
- **Total: $0/mes**

### **Opción Premium:**
- Railway: $5/mes
- Dominio personalizado: $1/mes
- MongoDB Atlas Pro: $9/mes
- **Total: ~$15/mes**

---

## 🎯 **PLAN DE MIGRACIÓN**

### **Fase 1: Preparación (1-2 días)**
1. ✅ Crear repositorio GitHub
2. ✅ Separar frontend/backend
3. ✅ Configurar variables de entorno
4. ✅ Testing local

### **Fase 2: Deploy Inicial (1 día)**
1. ✅ Deploy frontend a Netlify
2. ✅ Deploy backend a Railway
3. ✅ Configurar base de datos
4. ✅ Testing en producción

### **Fase 3: Optimización (ongoing)**
1. ✅ Dominio personalizado
2. ✅ Analytics
3. ✅ Monitoreo
4. ✅ Backups

---

## 🔧 **HERRAMIENTAS ÚTILES**

### **Para el Deploy:**
- 🌐 **Netlify** - Frontend hosting
- 🚂 **Railway** - Backend hosting  
- 🗄️ **MongoDB Atlas** - Database
- 📸 **Cloudinary** - Image hosting
- 📊 **Google Analytics** - Métricas

### **Para Monitoreo:**
- 🔍 **Sentry** - Error tracking
- 📈 **Uptime Robot** - Monitoring
- 📊 **Hotjar** - User behavior
- 💬 **Intercom** - Customer support