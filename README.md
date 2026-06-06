# INVENTARIO

App Node.js con Express y PostgreSQL lista para desplegar en Render.

## Qué subir a GitHub

Incluye únicamente estos archivos:
- `server.js`
- `package.json`
- `package-lock.json`
- `index.html`
- `css.css`
- `database.sql`
- `render.yaml`
- `seed_products.js`
- `list_tables.js`
- `.gitignore`

No subas:
- `.env`
- `.env.bak`
- `node_modules/`

## Cómo funciona en Render

- Render usará `npm install` y `npm start` para ejecutar el servidor.
- El servidor sirve `index.html` y las APIs desde el mismo dominio.
- El frontend usa `window.location.origin`, por lo que no necesita rutas fijas ni terminal en el navegador.

## Configuración de Render

En Render configura:
- Service type: `Web Service`
- Environment: `Node`
- Branch: `main`
- Build Command: `npm install`
- Start Command: `npm start`

Agrega la variable de entorno:
- `DATABASE_URL` = `postgresql://...`

## Cómo probar

Una vez desplegado, abre el dominio público en cualquier navegador:

```text
https://inventario-e40f.onrender.com/
```

No es necesario abrir terminal ni ejecutar ningún archivo en el equipo del visitante.

## Ejecutar localmente

Si quieres probar localmente desde la terminal del proyecto:

```powershell
cd C:\Users\mishi\Desktop\PROYECTO 2
node server.js
```

Luego abre `http://localhost:3000`.
