// src/bot/middlewares/index.ts

import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { setupRegistrationMiddleware } from './registration-state.middleware';

export function setupAllMiddlewares(
    bot: TelegramBot,
    registrationHandler: RegistrationHandler
) {
    console.log('🔄 Настройка middleware...');

    // Регистрируем middleware для каждого процесса
    setupRegistrationMiddleware(bot, registrationHandler);
    console.log('✅ Middleware настроены');
}