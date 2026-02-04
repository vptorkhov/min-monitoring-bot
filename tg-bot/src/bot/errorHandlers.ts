import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../config/database';

export function setupErrorHandlers(bot: TelegramBot) {
    console.log('🔧 Настройка обработчиков ошибок...');

    // Обработка ошибок бота
    bot.on('polling_error', (error) => {
        console.error('❌ Ошибка polling:', error);
    });

    bot.on('error', (error) => {
        console.error('❌ Ошибка бота:', error);
    });

    // Обработчик прерывания работы (Ctrl+C)
    process.on('SIGINT', async () => {
        console.log('\n🛑 Получен сигнал SIGINT, завершаем работу...');

        try {
            // Закрываем соединение с базой данных
            await dbClient.end();
            console.log('✅ Соединение с базой данных закрыто');

            // Останавливаем бота
            bot.stopPolling();
            console.log('✅ Бот остановлен');

            process.exit(0);
        } catch (error) {
            console.error('❌ Ошибка при завершении работы:', error);
            process.exit(1);
        }
    });

    // Обработчик необработанных исключений
    process.on('uncaughtException', (error) => {
        console.error('🔥 Необработанное исключение:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('🔥 Необработанный промис:', promise, 'причина:', reason);
    });

    console.log('✅ Обработчики ошибок настроены');
}