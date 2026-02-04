import { connectToDatabase } from './config/database';
import { createAndSetupBot } from './bot';
import { createServer, startServer } from './server';

async function main() {
    console.log('🚀 Запуск приложения Mobility Bot...\n');

    try {
        // 1. Подключаемся к базе данных
        await connectToDatabase();

        // 2. Создаем и настраиваем бота
        createAndSetupBot();

        // 3. Создаем и запускаем сервер
        const app = createServer();
        startServer(app);

        console.log('\n✅ Приложение успешно запущено!');
        console.log('📝 Отправьте /start в Telegram для начала работы\n');

    } catch (error) {
        console.error('❌ Ошибка запуска приложения:', error);
        process.exit(1);
    }
}

// Запускаем приложение
main();