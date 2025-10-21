# Instrucciones para desplegar en Render

1. Backend (Node.js):
   - Servicio Web en Render.
   - Puerto: 4000 (o el que Render detecte automáticamente)
   - Comando de inicio: `node backend/server.js`
   - Ruta de trabajo: raíz del repo o carpeta `backend`.

2. Frontend (Static Site):
   - Servicio Estático en Render.
   - Carpeta de publicación: `frontend`
   - No requiere build command si es HTML/CSS/JS puro.
   - Asegúrate de que `frontend/backend.json` apunte a la URL del backend de Render.

3. Elimina Netlify:
   - Borra el sitio desde el panel de Netlify.

4. Actualiza la documentación y referencias a Netlify en tu proyecto.

5. Haz commit y push de estos cambios para que Render los tome automáticamente.
