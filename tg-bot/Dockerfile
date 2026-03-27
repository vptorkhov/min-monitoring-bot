# Стадия сборки
FROM node:22-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
COPY tsconfig.json ./

# Устанавливаем ВСЕ зависимости
RUN npm ci

# Копируем исходный код
COPY src/ ./src/

# Собираем проект
RUN npm run build

# Стадия продакшн
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Создаем не-root пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Копируем package.json
COPY package*.json ./

# Устанавливаем ТОЛЬКО production зависимости
RUN npm ci --omit=dev && \
    npm cache clean --force

# Копируем собранный проект из стадии builder
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

# Меняем пользователя
USER nextjs

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]