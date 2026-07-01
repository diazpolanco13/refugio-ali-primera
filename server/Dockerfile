FROM node:22-alpine

WORKDIR /app

# Instalar dependencias de producción (tsx incluido para ejecutar TS).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
EXPOSE 3001

CMD ["npm", "run", "start"]
