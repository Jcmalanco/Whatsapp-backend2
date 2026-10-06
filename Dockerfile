# Imagen ligera para desplegar el backend en Render, un VPS, o cualquier
# servidor con Docker (pensado para escalar mas alla de Render/Vercel).
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/server.js"]
