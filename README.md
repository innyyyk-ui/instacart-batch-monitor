# 🚀 Instacart Batch Monitor

Monitor automático de batches de Instacart con notificaciones en tiempo real.

## ⚡ Instalación

```bash
npm install
```

## 🚀 Iniciar

```bash
npm start
```

## 📝 Variables de entorno

Crea un archivo `.env`:

```
INSTACART_EMAIL=tu_email@gmail.com
INSTACART_PASSWORD=tu_contraseña
NODE_ENV=production
PORT=3000
```

## 🔗 API

- `GET /status` - Estado del monitoreo
- `POST /start` - Iniciar monitoreo
- `POST /stop` - Detener monitoreo
- `POST /config` - Actualizar filtros

## 📦 Deploy

Sube a GitHub y deploya en Render.com
