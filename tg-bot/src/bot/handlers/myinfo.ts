import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';

export async function handleMyInfo(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    try {
        // Ищем курьера в базе данных по nickname (Telegram username)
        let query = '';
        let params = [];

        if (user.username) {
            // Ищем по username
            query = `SELECT full_name, nickname, phone_number, is_active, created_at 
                     FROM couriers 
                     WHERE nickname = $1 
                     LIMIT 1`;
            params = [user.username];
        } else {
            // Если нет username, ищем по имени + ID
            const searchNickname = `${user.first_name}_${user.id}`.toLowerCase().replace(/\s+/g, '_');
            query = `SELECT full_name, nickname, phone_number, is_active, created_at 
                     FROM couriers 
                     WHERE nickname LIKE $1 
                     LIMIT 1`;
            params = [`${user.first_name?.toLowerCase() || ''}_%`];
        }

        const result = await dbClient.query(query, params);

        if (result.rows.length === 0) {
            await bot.sendMessage(
                chatId,
                '❌ Вы не зарегистрированы в системе.\n' +
                'Пожалуйста, начните регистрацию с команды /start'
            );
            return;
        }

        const courier = result.rows[0];
        const registerDate = new Date(courier.created_at).toLocaleDateString('ru-RU');

        const infoText = `📋 *Ваша информация:*\n\n` +
            `*ФИО:* ${courier.full_name}\n` +
            `*Telegram:* ${user.username ? `@${user.username}` : 'не указан'}\n` +
            `*Телефон:* ${courier.phone_number}\n` +
            `*Статус:* ${courier.is_active ? '✅ Активен' : '❌ Неактивен'}\n` +
            `*Nickname в системе:* ${courier.nickname}\n` +
            `*Зарегистрирован:* ${registerDate}`;

        await bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('❌ Ошибка получения информации о курьере:', error);
        await bot.sendMessage(
            chatId,
            '❌ Ошибка при получении информации. Попробуйте позже.'
        );
    }
}