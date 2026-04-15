import createAndSetupBot from "./bot"; // функция для создания экземпляра бота и регистрации всех команд/обработчиков
import { closeDatabase, initializeDatabase } from "./config/database"; // функции для подключения/закрытия PostgreSQL
import { createServer, startServer } from "./server"; // функции для создания HTTP сервера (для вебхуков или health checks)
import type { Server } from "http";

let isShuttingDown = false;

async function stopHttpServer(server: Server): Promise<void> {
    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(undefined);
        });
    });
}

async function main() {
    console.log('🚀 Запуск приложения Mobility Bot...\n');

    try {
        // 1. Подключаемся к базе данных
        await initializeDatabase(); // инициализация пула соединений, проверка связи с БД

        // 2. Создаем и настраиваем бота
        const botSetup = await createAndSetupBot(); // создание экземпляра бота, подключение middleware, регистрация всех команд и обработчиков

        // 3. Создаем и запускаем сервер
        const app = createServer({
            bot: botSetup.bot,
            runtimeConfig: botSetup.runtimeConfig,
        }); // создание Express приложения, настройка маршрутов
        const server = startServer(app); // запуск HTTP сервера на указанном порту

        const gracefulShutdown = async (signal: string) => {
            if (isShuttingDown) {
                return;
            }
            isShuttingDown = true;

            console.log(`\n🛑 Получен сигнал ${signal}. Начинаем корректное завершение...`);

            try {
                botSetup.notifier.stop();

                if (botSetup.runtimeConfig.updateMode === 'polling') {
                    await botSetup.bot.stopPolling();
                } else if (botSetup.runtimeConfig.deleteWebhookOnShutdown) {
                    await botSetup.bot.deleteWebHook();
                }

                await stopHttpServer(server);
                await closeDatabase();
                console.log('✅ Приложение остановлено корректно');
                process.exit(0);
            } catch (error) {
                console.error('❌ Ошибка при завершении приложения:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

        console.log('\n✅ Приложение успешно запущено!');
        console.log('📝 Отправьте /start в Telegram для начала работы\n');

    } catch (error) {
        console.error('❌ Ошибка запуска приложения:', error);
        process.exit(1);
    }
}

// Запускаем приложение
main();