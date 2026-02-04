import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';
import { getCourierByTelegramId, getCourierByTelegramUsername, hasActiveSession } from './user-take-device';

//Завершаем сессию

export async function endSesion(courierId: number) {
    try {
        const hasSession = await hasActiveSession(courierId);
        if (!hasSession) {
            return {
                success: false,
                message: '❌ У вас нет активной сессии.'
            };
        }

        const result = await dbClient.query(
            `UPDATE sessions
     SET end_date = NOW()
     WHERE courier_id = $1
       AND end_date IS NULL
     RETURNING id, device_id`,
            [courierId]
        );

        if (result.rowCount === 0) {
            return {
                success: false,
                message: '❌ Активная сессия не найдена.'
            };
        }

        return {
            success: true,
            message: '✅ Сессия успешно завершена.',
        };

    } catch (error: any) {
        console.error('❌ Ошибка завершении сессии:', error);
        return {
            success: false,
            message: `❌ Ошибка завершении сессии: ${error.message || 'Неизвестная ошибка'}`
        };
    }
}

// Обработчик команды завершения сессии
export async function handleEndSession(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`⏹️ Запрос на завершение сессии от ${user.first_name || 'пользователь'} (ID: ${user.id})`);

    // Ищем курьера
    let courier = null;

    if (user.username) {
        courier = await getCourierByTelegramUsername(user.username);
    }

    if (!courier) {
        courier = await getCourierByTelegramId(user.id);
    }

    if (!courier) {
        await bot.sendMessage(
            chatId,
            '❌ Вы не зарегистрированы как курьер.\n\n' +
            'Пожалуйста, сначала зарегистрируйтесь через команду /start'
        );
        return;
    }

    // Завершаем сессию
    const result = await endSesion(courier.id);

    await bot.sendMessage(chatId, result.message);

    if (result.success) {
        // Обновляем клавиатуру после завершения
        await bot.sendMessage(
            chatId,
            '🔄 *Что дальше?*\n\n' +
            '• Вы можете взять новое средство\n' +
            '• Посмотреть профиль\n' +
            '• Обратиться за помощью',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [
                        [{ text: '🛴 Хочу взять СИМ' }, { text: '📱 Мой профиль' }],
                        [{ text: '✅ Свободные средства' }, { text: '❓ Помощь' }]
                    ],
                    resize_keyboard: true
                }
            }
        );
    }
}

export async function handleEndSessionButton(bot: TelegramBot, msg: TelegramBot.Message) {
    await handleEndSession(bot, msg);
}
