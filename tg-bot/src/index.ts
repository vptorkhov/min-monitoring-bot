import createAndSetupBot from "./bot"; // функция для создания экземпляра бота и регистрации всех команд/обработчиков
import { initializeDatabase } from "./config/database"; // функция для подключения к PostgreSQL
import { createServer, startServer } from "./server"; // функции для создания HTTP сервера (для вебхуков или health checks)

async function main() {
    console.log('🚀 Запуск приложения Mobility Bot...\n');

    try {
        // 1. Подключаемся к базе данных
        await initializeDatabase(); // инициализация пула соединений, проверка связи с БД

        // 2. Создаем и настраиваем бота
        await createAndSetupBot(); // создание экземпляра бота, подключение middleware, регистрация всех команд и обработчиков

        // 3. Создаем и запускаем сервер
        const app = createServer(); // создание Express приложения, настройка маршрутов
        startServer(app); // запуск HTTP сервера на указанном порту

        console.log('\n✅ Приложение успешно запущено!');
        console.log('📝 Отправьте /start в Telegram для начала работы\n');

    } catch (error) {
        console.error('❌ Ошибка запуска приложения:', error);
        process.exit(1);
    }
}

// Запускаем приложение
main();