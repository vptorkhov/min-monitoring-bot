import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';
import { setupBotHandlers } from './setup';
import { setupErrorHandlers } from './errorHandlers';

export function createAndSetupBot(): TelegramBot {
    console.log('🤖 Создание экземпляра бота...');

    const bot = new TelegramBot(config.BOT_TOKEN!, { polling: true });

    // Настраиваем обработчики
    setupBotHandlers(bot);
    setupErrorHandlers(bot);

    console.log('✅ Бот создан и настроен');
    return bot;
}