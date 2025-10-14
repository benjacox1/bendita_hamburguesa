# Bendita Hamburguesa 🍔

Una aplicación web completa para pedidos de hamburguesas con integración de MercadoPago.

## 🚀 Características

- 🍔 Catálogo de productos interactivo
- 🛒 Carrito de compras persistente
- 💳 Integración completa con MercadoPago
- 📱 Diseño responsive
- ⚡ Animaciones y transiciones suaves
- 🔔 Sistema de notificaciones
- 👨‍💼 Panel de administración

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Base de Datos**: JSON (archivo)
- **Pagos**: MercadoPago API
- **Hosting**: Netlify + Railway
- **Túnel**: Cloudflare Tunnel

## 📦 Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/TU-USUARIO/bendita-hamburguesa.git
cd bendita-hamburguesa

# Instalar dependencias
cd backend
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de MercadoPago

# Iniciar servidor
npm start
```

## 🌐 Deploy en Producción

### Frontend (Netlify)
1. Conecta este repositorio a Netlify
2. Configura:
   - Build command: `npm run build`
   - Publish directory: `frontend`

### Backend (Railway)
1. Conecta este repositorio a Railway
2. Configura las variables de entorno
3. Deploy automático

## 📁 Estructura del Proyecto

```
bendita-hamburguesa/
├── frontend/              # Aplicación frontend
│   ├── index.html
│   ├── main.css
│   ├── main.js
│   ├── animations.css     # Animaciones y efectos
│   ├── notifications.js   # Sistema de notificaciones
│   └── loading.js         # Estados de carga
├── backend/               # API del servidor
│   ├── server.js
│   ├── data/
│   │   ├── products.json
│   │   └── orders.json
│   └── logs/
└── docs/                  # Documentación
```

## 🔧 Variables de Entorno

```env
MP_ACCESS_TOKEN=tu_token_de_mercadopago
MP_PUBLIC_KEY=tu_public_key
MP_WEBHOOK=https://tu-dominio.com/webhooks/mercadopago
PORT=4000
NODE_ENV=production
```

## 📱 URLs de la Aplicación

- **Frontend**: https://bendita-hamburguesa.netlify.app
- **Admin Panel**: https://bendita-hamburguesa.netlify.app/PanelAdmin/
- **API Backend**: https://bendita-hamburguesa-api.railway.app

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea tu rama de feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE.md](LICENSE.md) para detalles.

## 📞 Contacto

Tu Nombre - [@tu_twitter](https://twitter.com/tu_twitter)

Link del Proyecto: [https://github.com/TU-USUARIO/bendita-hamburguesa](https://github.com/TU-USUARIO/bendita-hamburguesa)