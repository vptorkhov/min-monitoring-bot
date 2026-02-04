import TelegramBot from 'node-telegram-bot-api';
import { Keyboards } from '../keyboards';
import { isAdmin } from './admin';

export async function handleHelp(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userName = user?.first_name || 'Неизвестный пользователь';

    console.log(`🎯 Команда /help от ${userName} (ID: ${chatId})`);

    // Проверяем, является ли пользователь администратором
    let isUserAdmin = false;
    if (user) {
        isUserAdmin = await isAdmin(user.id);
    }

    let helpText = `📋 *Доступные команды:*\n\n` +
        `🚀 *Навигация:*\n` +
        `/start или СТАРТ - Начать работу/регистрацию\n` +
        `/help или Помощь - Показать эту справку\n\n` +

        `👤 *Курьер:*\n` +
        `/myinfo - Моя информация\n` +
        `/takedevice - Взять СИМ для работы\n` +
        `/endsession - Завершить сессию\n` +
        `/available - Свободные средства\n` +
        `/cancel - Отмена текущего действия\n`;

    // Добавляем команды администратора, если пользователь админ
    if (isUserAdmin) {
        helpText += `\n⚙️ *Администратор:*\n` +
            `/admin - Панель администратора\n` +
            `/adddevice - Добавить новое СИМ\n` +
            `/devices - Просмотр всех СИМ\n` +
            `/managedevices - Управление СИМ\n` +
            `/couriers - Просмотр списка курьеров\n` +
            `/managecouriers - Управление курьерами\n` +
            `/activesessions - Просмотр активных сессий\n` +
            `/sessionhistory - История сессий по дате\n` +
            `\n📱 *Быстрые кнопки:*\n` +
            `• "🛴 Добавить СИМ" - Добавить новое средство\n` +
            `• "📋 Все СИМ" - Просмотреть все средства\n` +
            `• "🛠️ Управление СИМ" - Управление статусами СИМ\n` +
            `• "👥 Курьеры" - Просмотр списка курьеров\n` +
            `• "👥 Управление курьерами" - Управление статусами курьеров\n` +
            `• "📅 Активные сессии" - Просмотр активных сессий\n` +
            `• "📅 История сессий" - Просмотр истории по дате\n` +
            `• "⚙️ Админ-панель" - Панель управления\n`;
    }

    // Используем разные клавиатуры для админов и обычных пользователей
    const keyboard = isUserAdmin
        ? Keyboards.quickAccess
        : Keyboards.start;

    try {
        const keyboard = isUserAdmin
            ? Keyboards.quickAccess
            : Keyboards.start;

        await bot.sendMessage(chatId, helpText, {
            parse_mode: 'Markdown',
            ...keyboard
        });
    } catch {
        // Если ошибка с Markdown, отправляем без него
        await bot.sendMessage(chatId, helpText.replace(/\*/g, ''), keyboard);
    }
}