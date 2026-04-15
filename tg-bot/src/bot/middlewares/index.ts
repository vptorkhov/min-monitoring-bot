// src/bot/middlewares/index.ts

import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { setupRegistrationMiddleware } from './registration-state.middleware';
import { setupUpdateLoggingMiddleware } from './update-logging.middleware';

/** Регистрирует все middleware в корректном порядке. */
export function setupAllMiddlewares(
    bot: TelegramBot,
    registrationHandler: RegistrationHandler
) {
    console.log('🔄 Настройка middleware...');

    setupUpdateLoggingMiddleware(bot);
    setupRegistrationMiddleware(bot, registrationHandler);
    console.log('✅ Middleware настроены');
}