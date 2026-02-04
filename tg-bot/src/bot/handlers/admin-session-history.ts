import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';
import { isAdmin } from './admin';

// Состояние для просмотра истории сессий
interface SessionHistoryState {
    step: 'awaiting_date' | 'completed';
    tempData?: {
        selectedDate?: string;
    };
}

// Менеджер состояний для истории сессий
class SessionHistoryStateManager {
    private states = new Map<number, SessionHistoryState>();

    get(telegramId: number): SessionHistoryState | undefined {
        return this.states.get(telegramId);
    }

    set(telegramId: number, state: SessionHistoryState): void {
        this.states.set(telegramId, state);
    }

    delete(telegramId: number): boolean {
        return this.states.delete(telegramId);
    }
}

export const sessionHistoryStateManager = new SessionHistoryStateManager();

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

// Получаем сессии за конкретную дату
export async function getSessionsByDate(date: Date): Promise<Array<{
    courier_id: number;
    courier_full_name: string;
    courier_phone_number: string;
    device_number: string;
    device_type: string;
    is_personal: boolean;
    session_id: number;
    start_date: Date;
    end_date: Date | null;
    is_active: boolean;
}>> {
    try {
        // Начало и конец выбранного дня
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const result = await dbClient.query(
            `SELECT 
                c.id as courier_id,
                c.full_name as courier_full_name,
                c.phone_number as courier_phone_number,
                md.device_number,
                md.device_type,
                md.is_personal,
                s.id as session_id,
                s.start_date,
                s.end_date,
                s.end_date IS NULL as is_active
             FROM sessions s
             JOIN couriers c ON s.courier_id = c.id
             JOIN mobility_devices md ON s.device_id = md.id
             WHERE (
                 -- Сессии, которые начались в этот день
                 DATE(s.start_date) = DATE($1)
                 OR 
                 -- Сессии, которые закончились в этот день
                 (s.end_date IS NOT NULL AND DATE(s.end_date) = DATE($1))
                 OR
                 -- Активные сессии, которые начались до этого дня и еще не закончились
                 (s.end_date IS NULL AND s.start_date <= $2 AND ($3 IS NULL OR $3 >= $1))
             )
             ORDER BY s.start_date DESC`,
            [date, endOfDay, startOfDay]
        );

        return result.rows;
    } catch (error) {
        console.error('❌ Ошибка получения сессий по дате:', error);
        return [];
    }
}

// Проверяем формат даты дд.мм.гггг
function isValidDateFormat(dateStr: string): boolean {
    const regex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!regex.test(dateStr)) return false;

    const [day, month, year] = dateStr.split('.').map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
}

// Парсим дату из формата дд.мм.гггг
function parseDate(dateStr: string): Date | null {
    const [day, month, year] = dateStr.split('.').map(Number);
    const date = new Date(year, month - 1, day);

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }

    return date;
}

// Обработчик команды для просмотра истории сессий
export async function handleSessionHistory(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`🎯 Запрос на просмотр истории сессий от ${user.first_name || 'пользователь'} (ID: ${user.id})`);

    // Проверяем, является ли пользователь администратором
    const userIsAdmin = await isAdmin(user.id);

    if (!userIsAdmin) {
        await bot.sendMessage(
            chatId,
            '⛔ У вас нет прав для выполнения этой команды.\n' +
            'Только администраторы могут просматривать историю сессий.'
        );
        return;
    }

    // Запрашиваем дату
    const requestText = `📅 *Просмотр истории сессий*\n\n` +
        `Введите дату в формате *дд.мм.гггг*\n\n` +
        `*Пример:* 03.02.2026\n\n` +
        `*Сегодня:* ${new Date().toLocaleDateString('ru-RU')}\n` +
        `*Введите дату:*`;

    await bot.sendMessage(chatId, requestText, { parse_mode: 'Markdown' });

    // Устанавливаем состояние ожидания даты
    sessionHistoryStateManager.set(user.id, {
        step: 'awaiting_date'
    });
}

// Обработчик кнопки "История сессий"
export async function handleSessionHistoryButton(bot: TelegramBot, msg: TelegramBot.Message) {
    await handleSessionHistory(bot, msg);
}

// Обработчик текстовых сообщений для истории сессий
export async function handleSessionHistoryMessage(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const user = msg.from;

    if (!user) {
        return;
    }

    // Пропускаем команды
    if (text.startsWith('/')) {
        return;
    }

    // Получаем текущее состояние истории сессий
    const sessionHistoryState = sessionHistoryStateManager.get(user.id);

    if (!sessionHistoryState) {
        return; // Нет состояния - не процесс просмотра истории
    }

    // Обработка в зависимости от шага
    if (sessionHistoryState.step === 'awaiting_date') {
        // Пользователь ввел дату
        const dateStr = text.trim();

        if (!dateStr) {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите дату.'
            );
            return;
        }

        // Проверяем формат даты
        if (!isValidDateFormat(dateStr)) {
            await bot.sendMessage(
                chatId,
                `❌ Неверный формат даты.\n\n` +
                `Пожалуйста, введите дату в формате *дд.мм.гггг*\n` +
                `*Пример:* 03.02.2026\n\n` +
                `Попробуйте снова:`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Парсим дату
        const selectedDate = parseDate(dateStr);

        if (!selectedDate) {
            await bot.sendMessage(
                chatId,
                '❌ Некорректная дата. Пожалуйста, введите существующую дату.'
            );
            return;
        }

        // Проверяем, что дата не в будущем (можно убрать, если нужно)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate > today) {
            await bot.sendMessage(
                chatId,
                '⚠️ Нельзя выбрать будущую дату. Пожалуйста, введите прошедшую или сегодняшнюю дату.'
            );
            return;
        }

        // Получаем сессии за выбранную дату
        const sessions = await getSessionsByDate(selectedDate);

        // Форматируем дату для отображения
        const formattedDate = selectedDate.toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        if (sessions.length === 0) {
            await bot.sendMessage(
                chatId,
                `📭 *${formattedDate}*\n\n` +
                `На эту дату не найдено ни одной сессии.`
            );
            sessionHistoryStateManager.delete(user.id);
            return;
        }

        // Формируем список сессий
        let sessionsText = `📅 *${formattedDate}*\n\n`;
        sessionsText += `📊 *Сессий за день: ${sessions.length}*\n\n`;

        // Группируем по курьерам для лучшей читаемости
        const sessionsByCourier: { [key: string]: Array<typeof sessions[0]> } = {};

        sessions.forEach(session => {
            const courierKey = `${session.courier_full_name}_${session.courier_phone_number}`;
            if (!sessionsByCourier[courierKey]) {
                sessionsByCourier[courierKey] = [];
            }
            sessionsByCourier[courierKey].push(session);
        });

        // Выводим сессии по каждому курьеру
        Object.values(sessionsByCourier).forEach((courierSessions, courierIndex) => {
            const firstSession = courierSessions[0];

            sessionsText += `*${courierIndex + 1}. ${firstSession.courier_full_name}*\n`;
            sessionsText += `   📞 *Телефон:* ${firstSession.courier_phone_number}\n`;

            // Выводим все сессии этого курьера за день
            courierSessions.forEach((session, sessionIndex) => {
                const deviceDisplay = session.is_personal
                    ? '🛴 *Личный*'
                    : `🛴 *${session.device_number}* (${session.device_type})`;

                const startTime = formatMoscowTime(session.start_date);
                let endTime = 'Активная';

                if (session.end_date) {
                    endTime = formatMoscowTime(session.end_date);

                    // Рассчитываем длительность для завершенных сессий
                    const durationMs = session.end_date.getTime() - session.start_date.getTime();
                    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
                    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                    const durationText = durationHours > 0
                        ? `${durationHours}ч ${durationMinutes}м`
                        : `${durationMinutes}м`;

                    sessionsText += `   ${sessionIndex + 1}. ${deviceDisplay}\n`;
                    sessionsText += `      ⏰ *Начало:* ${startTime} (МСК)\n`;
                    sessionsText += `      ⏹️ *Конец:* ${endTime} (МСК)\n`;
                    sessionsText += `      ⏳ *Длительность:* ${durationText}\n`;
                } else {
                    // Активная сессия
                    const durationMs = new Date().getTime() - session.start_date.getTime();
                    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
                    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                    const durationText = durationHours > 0
                        ? `${durationHours}ч ${durationMinutes}м`
                        : `${durationMinutes}м`;

                    sessionsText += `   ${sessionIndex + 1}. ${deviceDisplay}\n`;
                    sessionsText += `      ⏰ *Начало:* ${startTime} (МСК)\n`;
                    sessionsText += `      🟢 *Конец:* ${endTime}\n`;
                    sessionsText += `      ⏳ *Длительность:* ${durationText} (активно)\n`;
                }
            });

            sessionsText += '\n';
        });

        // Добавляем статистику
        const activeSessions = sessions.filter(s => s.is_active).length;
        const completedSessions = sessions.length - activeSessions;
        const personalSessions = sessions.filter(s => s.is_personal).length;
        const companySessions = sessions.filter(s => !s.is_personal).length;

        sessionsText += `📈 *Статистика за ${selectedDate.toLocaleDateString('ru-RU')}:*\n`;
        sessionsText += `   • Всего сессий: ${sessions.length}\n`;
        sessionsText += `   • Активных: ${activeSessions}\n`;
        sessionsText += `   • Завершенных: ${completedSessions}\n`;
        sessionsText += `   • На личных средствах: ${personalSessions}\n`;
        sessionsText += `   • На средствах компании: ${companySessions}\n`;
        sessionsText += `   • Уникальных курьеров: ${Object.keys(sessionsByCourier).length}`;

        await bot.sendMessage(chatId, sessionsText, { parse_mode: 'Markdown' });

        // Предлагаем посмотреть другую дату
        await bot.sendMessage(
            chatId,
            `🔄 Хотите посмотреть историю за другую дату?\n\n` +
            `Нажмите "История сессий" или введите /sessionhistory`,
            {
                reply_markup: {
                    keyboard: [
                        [{ text: '📅 История сессий' }, { text: '📅 Активные сессии' }],
                        [{ text: '📊 Статистика' }, { text: '⚙️ Админ-панель' }]
                    ],
                    resize_keyboard: true
                }
            }
        );

        // Удаляем состояние
        sessionHistoryStateManager.delete(user.id);
    }
}