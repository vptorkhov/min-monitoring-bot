import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';
import { isAdmin } from './admin';

// Получаем список всех курьеров с их текущими СИМ
export async function getAllCouriersWithDevices(): Promise<Array<{
    id: number;
    full_name: string;
    nickname: string;
    phone_number: string;
    is_active: boolean;
    current_device_number: string | null;
    current_device_type: string | null;
    session_start_date: string | null;
}>> {
    try {
        const result = await dbClient.query(
            `SELECT 
                c.id,
                c.full_name,
                c.nickname,
                c.phone_number,
                c.is_active,
                md.device_number as current_device_number,
                md.device_type as current_device_type,
                s.start_date as session_start_date
             FROM couriers c
             LEFT JOIN sessions s ON c.id = s.courier_id AND s.end_date IS NULL
             LEFT JOIN mobility_devices md ON s.device_id = md.id
             ORDER BY c.full_name`
        );

        return result.rows.map(row => ({
            ...row,
            session_start_date: row.session_start_date ?
                new Date(row.session_start_date).toLocaleString('ru-RU') : null
        }));
    } catch (error) {
        console.error('❌ Ошибка получения списка курьеров:', error);
        return [];
    }
}

// Обработчик команды для просмотра курьеров
export async function handleViewCouriers(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`🎯 Запрос на просмотр курьеров от ${user.first_name || 'пользователь'} (ID: ${user.id})`);

    // Проверяем, является ли пользователь администратором
    const userIsAdmin = await isAdmin(user.id);

    if (!userIsAdmin) {
        await bot.sendMessage(
            chatId,
            '⛔ У вас нет прав для выполнения этой команды.\n' +
            'Только администраторы могут просматривать список курьеров.'
        );
        return;
    }

    // Получаем список всех курьеров
    const couriers = await getAllCouriersWithDevices();

    if (couriers.length === 0) {
        await bot.sendMessage(
            chatId,
            '📭 В базе данных нет зарегистрированных курьеров.'
        );
        return;
    }

    // Формируем список курьеров
    let couriersText = `👥 *Список всех курьеров (${couriers.length}):*\n\n`;

    couriers.forEach((courier, index) => {
        const statusIcon = courier.is_active ? '✅' : '❌';
        const deviceInfo = courier.current_device_number
            ? `🛴 *СИМ:* ${courier.current_device_number} (${courier.current_device_type})\n   📅 *С:* ${courier.session_start_date}`
            : '🆓 *СИМ:* Нет активной сессии';

        couriersText += `*${index + 1}. ${courier.full_name}*\n`;
        couriersText += `   👤 *Ник:* ${courier.nickname || 'не указан'}\n`;
        couriersText += `   📞 *Телефон:* ${courier.phone_number}\n`;
        couriersText += `   ${deviceInfo}\n`;
        couriersText += `   ${statusIcon} *Статус:* ${courier.is_active ? 'Активен' : 'Неактивен'}\n\n`;
    });

    // Добавляем статистику
    const activeCouriers = couriers.filter(c => c.is_active).length;
    const couriersWithDevice = couriers.filter(c => c.current_device_number).length;

    couriersText += `📊 *Статистика:*\n`;
    couriersText += `   • Всего курьеров: ${couriers.length}\n`;
    couriersText += `   • Активных: ${activeCouriers}\n`;
    couriersText += `   • С активной сессией: ${couriersWithDevice}\n`;
    couriersText += `   • Без сессии: ${activeCouriers - couriersWithDevice}`;

    await bot.sendMessage(chatId, couriersText, { parse_mode: 'Markdown' });
}

// Обработчик кнопки "Курьеры"
export async function handleViewCouriersButton(bot: TelegramBot, msg: TelegramBot.Message) {
    await handleViewCouriers(bot, msg);
}