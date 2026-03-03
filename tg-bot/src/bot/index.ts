// src/bot/index.ts

import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { initBot } from './init';

dotenv.config();

export default async function createAndSetupBot() {
    console.log('🤖 Настройка Telegram бота...');

    const token = process.env.BOT_TOKEN;
    if (!token) {
        throw new Error('❌ Отсутствует BOT_TOKEN в .env файле');
    }

    // Создание экземпляра бота с long polling
    const bot = new TelegramBot(token, { polling: true });

    // Базовое логирование ошибок
    bot.on('polling_error', (error) => {
        console.error('❌ Ошибка polling:', error);
    });

    bot.on('error', (error) => {
        console.error('❌ Ошибка бота:', error);
    });

    // Инициализация всех компонентов бота (сервисы, обработчики, middleware, команды)
    const { courierService, registrationHandler } = initBot(bot);

    console.log('✅ Telegram бот успешно настроен и запущен');

    // Возвращаем созданные экземпляры для возможного использования в других частях приложения
    return { bot, courierService, registrationHandler };
}