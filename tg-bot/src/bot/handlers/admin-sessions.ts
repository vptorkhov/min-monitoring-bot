import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';
import { isAdmin } from './admin';

// Получаем список активных сессий
export async function getActiveSessions(): Promise<Array<{
    courier_id: number;
    courier_full_name: string;
    courier_phone_number: string;
    device_id: number;
    device_number: string;
    device_type: string;
    is_personal: boolean;
    session_id: number;
    start_date: Date;
}>> {
    try {
        const result = await dbClient.query(
            `SELECT 
                c.id as courier_id,
                c.full_name as courier_full_name,
                c.phone_number as courier_phone_number,
                md.id as device_id,
                md.device_number,
                md.device_type,
                md.is_personal,
                s.id as session_id,
                s.start_date
             FROM sessions s
             JOIN couriers c ON s.courier_id = c.id
             JOIN mobility_devices md ON s.device_id = md.id
             WHERE s.end_date IS NULL
             ORDER BY s.start_date DESC`
        );

        return result.rows;
    } catch (error) {
        console.error('❌ Ошибка получения активных сессий:', error);
        return [];
    }
}

// Форматируем дату в московское время
function formatMoscowTime(date: Date): string {
    // Москва: UTC+3
    const moscowDate = new Date(date.getTime() + (3 * 60 * 60 * 1000));

    const day = moscowDate.getDate().toString().padStart(2, '0');
    const month = (moscowDate.getMonth() + 1).toString().padStart(2, '0');
    const year = moscowDate.getFullYear();
    const hours = moscowDate.getHours().toString().padStart(2, '0');
    const minutes = moscowDate.getMinutes().toString().padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Обработчик команды для просмотра активных сессий
export async function handleActiveSessions(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`🎯 Запрос на просмотр активных сессий от ${user.first_name || 'пользователь'} (ID: ${user.id})`);

    // Проверяем, является ли пользователь администратором
    const userIsAdmin = await isAdmin(user.id);

    if (!userIsAdmin) {
        await bot.sendMessage(
            chatId,
            '⛔ У вас нет прав для выполнения этой команды.\n' +
            'Только администраторы могут просматривать активные сессии.'
        );
        return;
    }

    // Получаем список активных сессий
    const sessions = await getActiveSessions();

    if (sessions.length === 0) {
        await bot.sendMessage(
            chatId,
            '📭 Нет активных сессий на данный момент.'
        );
        return;
    }

    // Формируем список активных сессий
    let sessionsText = `📊 *Активные сессии (${sessions.length}):*\n\n`;

    sessions.forEach((session, index) => {
        const deviceDisplay = session.is_personal
            ? '🛴 *Личный*'
            : `🛴 *${session.device_number}* (${session.device_type})`;

        const moscowTime = formatMoscowTime(session.start_date);
        const duration = calculateDuration(session.start_date, new Date());

        sessionsText += `*${index + 1}. ${session.courier_full_name}*\n`;
        sessionsText += `   📞 *Телефон:* ${session.courier_phone_number}\n`;
        sessionsText += `   ${deviceDisplay}\n`;
        sessionsText += `   ⏰ *Начало:* ${moscowTime} (МСК)\n`;
        sessionsText += `   ⏳ *Длительность:* ${duration}\n\n`;
    });

    // Добавляем статистику
    const personalSessions = sessions.filter(s => s.is_personal).length;
    const companySessions = sessions.filter(s => !s.is_personal).length;

    sessionsText += `📈 *Статистика:*\n`;
    sessionsText += `   • Всего активных сессий: ${sessions.length}\n`;
    sessionsText += `   • На личных средствах: ${personalSessions}\n`;
    sessionsText += `   • На средствах компании: ${companySessions}\n`;
    sessionsText += `   • Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`;

    await bot.sendMessage(chatId, sessionsText, { parse_mode: 'Markdown' });
}

// Вспомогательная функция для расчета длительности
function calculateDuration(startDate: Date, endDate: Date): string {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
        return `${diffHours}ч ${diffMinutes}м`;
    }
    return `${diffMinutes} минут`;
}

// Обработчик кнопки "Активные сессии"
export async function handleActiveSessionsButton(bot: TelegramBot, msg: TelegramBot.Message) {
    await handleActiveSessions(bot, msg);
}