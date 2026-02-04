# Стадия сборки
FROM node:18-alpine AS builder

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
FROM node:18-alpine

WORKDIR /app

# Создаем не-root пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Копируем package.json
COPY package*.json ./

# Устанавливаем ТОЛЬКО production зависимости
RUN npm ci --only=production && \
    npm cache clean --force

# Копируем собранный проект из стадии builder
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

# Копируем package.json для корректного запуска
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Меняем пользователя
USER nextjs

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]