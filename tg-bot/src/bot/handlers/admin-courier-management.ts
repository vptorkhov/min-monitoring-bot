import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';
import { isAdmin } from './admin';
import { Keyboards } from '../keyboards';

// Состояние для управления курьерами
interface CourierManagementState {
    step: 'awaiting_courier_number' | 'awaiting_action' | 'completed';
    tempData?: {
        courierId?: number;
        fullName?: string;
        phoneNumber?: string;
        nickname?: string;
        isActive?: boolean;
    };
}

// Менеджер состояний для управления курьерами
class CourierManagementStateManager {
    private states = new Map<number, CourierManagementState>();

    get(telegramId: number): CourierManagementState | undefined {
        return this.states.get(telegramId);
    }

    set(telegramId: number, state: CourierManagementState): void {
        this.states.set(telegramId, state);
    }

    delete(telegramId: number): boolean {
        return this.states.delete(telegramId);
    }
}

export const courierManagementStateManager = new CourierManagementStateManager();

// Получаем список всех курьеров для управления
export async function getAllCouriersForManagement(): Promise<Array<{
    id: number;
    full_name: string;
    nickname: string;
    phone_number: string;
    is_active: boolean;
    has_active_session: boolean;
}>> {
    try {
        const result = await dbClient.query(
            `SELECT 
                c.id,
                c.full_name,
                c.nickname,
                c.phone_number,
                c.is_active,
                EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.courier_id = c.id AND s.end_date IS NULL
                ) as has_active_session
             FROM couriers c
             ORDER BY c.full_name`
        );

        return result.rows;
    } catch (error) {
        console.error('❌ Ошибка получения списка курьеров:', error);
        return [];
    }
}

// Отключаем курьера (меняем is_active на false)
export async function disableCourier(courierId: number): Promise<{ success: boolean; message: string }> {
    try {
        // Проверяем, есть ли у курьера активная сессия
        const checkSession = await dbClient.query(
            'SELECT id FROM sessions WHERE courier_id = $1 AND end_date IS NULL',
            [courierId]
        );

        if (checkSession.rows.length > 0) {
            return {
                success: false,
                message: '❌ Невозможно отключить курьера: у него активная сессия.\n' +
                    'Завершите сессию сначала.'
            };
        }

        // Получаем информацию о курьере перед отключением
        const courierInfo = await dbClient.query(
            'SELECT full_name, phone_number FROM couriers WHERE id = $1',
            [courierId]
        );

        const courier = courierInfo.rows[0];

        if (!courier) {
            return {
                success: false,
                message: '❌ Курьер не найден.'
            };
        }

        // Отключаем курьера
        await dbClient.query(
            'UPDATE couriers SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
            [courierId]
        );

        return {
            success: true,
            message: `✅ Курьер успешно отключен!\n\n` +
                `*ФИО:* ${courier.full_name}\n` +
                `*Телефон:* ${courier.phone_number}\n` +
                `*Статус:* ❌ Отключен\n\n` +
                `Теперь курьер не будет отображаться в активных списках.`
        };
    } catch (error: any) {
        console.error('❌ Ошибка при отключении курьера:', error);
        return {
            success: false,
            message: `❌ Ошибка при отключении курьера: ${error.message || 'Неизвестная ошибка'}`
        };
    }
}

// Удаляем курьера из базы данных
export async function deleteCourier(courierId: number): Promise<{ success: boolean; message: string }> {
    try {
        // Проверяем, есть ли у курьера активная сессия
        const checkSession = await dbClient.query(
            'SELECT id FROM sessions WHERE courier_id = $1 AND end_date IS NULL',
            [courierId]
        );

        if (checkSession.rows.length > 0) {
            return {
                success: false,
                message: '❌ Невозможно удалить курьера: у него активная сессия.\n' +
                    'Завершите сессию сначала.'
            };
        }

        // Проверяем, есть ли история сессий у курьера
        const checkHistory = await dbClient.query(
            'SELECT id FROM sessions WHERE courier_id = $1 LIMIT 1',
            [courierId]
        );

        // Получаем информацию о курьере
        const courierInfo = await dbClient.query(
            'SELECT full_name, phone_number FROM couriers WHERE id = $1',
            [courierId]
        );

        const courier = courierInfo.rows[0];

        if (!courier) {
            return {
                success: false,
                message: '❌ Курьер не найден.'
            };
        }

        if (checkHistory.rows.length > 0) {
            // Если есть история, только отключаем
            await dbClient.query(
                'UPDATE couriers SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
                [courierId]
            );

            return {
                success: true,
                message: `⚠️ У курьера есть история сессий, поэтому он был отключен вместо удаления.\n\n` +
                    `*ФИО:* ${courier.full_name}\n` +
                    `*Телефон:* ${courier.phone_number}\n` +
                    `*Статус:* ❌ Отключен\n\n` +
                    `Данные о сессиях сохранены для отчетности.`
            };
        }

        // Если нет истории - удаляем полностью
        await dbClient.query('DELETE FROM couriers WHERE id = $1', [courierId]);

        return {
            success: true,
            message: `🗑️ Курьер успешно удален из базы данных!\n\n` +
                `*ФИО:* ${courier.full_name}\n` +
                `*Телефон:* ${courier.phone_number}\n\n` +
                `Все данные о курьере полностью удалены.`
        };
    } catch (error: any) {
        console.error('❌ Ошибка при удалении курьера:', error);
        return {
            success: false,
            message: `❌ Ошибка при удалении курьера: ${error.message || 'Неизвестная ошибка'}`
        };
    }
}

// Обработчик команды для управления курьерами
export async function handleManageCouriers(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`🎯 Запрос на управление курьерами от ${user.first_name || 'пользователь'} (ID: ${user.id})`);

    // Проверяем, является ли пользователь администратором
    const userIsAdmin = await isAdmin(user.id);

    if (!userIsAdmin) {
        await bot.sendMessage(
            chatId,
            '⛔ У вас нет прав для выполнения этой команды.\n' +
            'Только администраторы могут управлять курьерами.'
        );
        return;
    }

    // Получаем список всех курьеров
    const couriers = await getAllCouriersForManagement();

    if (couriers.length === 0) {
        await bot.sendMessage(
            chatId,
            '📭 В базе данных нет курьеров для управления.'
        );
        return;
    }

    // Формируем список курьеров
    let couriersText = `👥 *Управление курьерами*\n\n`;
    couriersText += `📋 *Список всех курьеров (${couriers.length}):*\n\n`;

    couriers.forEach((courier, index) => {
        const statusIcon = courier.is_active ? '✅' : '❌';
        const sessionIcon = courier.has_active_session ? '🛴' : '🆓';

        couriersText += `*${index + 1}. ${courier.full_name}*\n`;
        couriersText += `   👤 *Ник:* ${courier.nickname || 'не указан'}\n`;
        couriersText += `   📞 *Телефон:* ${courier.phone_number}\n`;
        couriersText += `   ${sessionIcon} *Сессия:* ${courier.has_active_session ? 'Есть' : 'Нет'}\n`;
        couriersText += `   ${statusIcon} *Статус:* ${courier.is_active ? 'Активен' : 'Отключен'}\n\n`;
    });

    couriersText += `✏️ *Инструкция:*\n`;
    couriersText += `Введите *порядковый номер* курьера из списка (1, 2, 3...)\n\n`;
    couriersText += `*Пример:* введите "1" для первого курьера\n\n`;
    couriersText += `*Введите номер:*`;

    await bot.sendMessage(chatId, couriersText, { parse_mode: 'Markdown' });

    // Устанавливаем состояние ожидания номера
    courierManagementStateManager.set(user.id, {
        step: 'awaiting_courier_number'
    });
}

// Обработчик кнопки "Управление курьерами"
export async function handleManageCouriersButton(bot: TelegramBot, msg: TelegramBot.Message) {
    await handleManageCouriers(bot, msg);
}

// Обработчик текстовых сообщений для управления курьерами
export async function handleCourierManagementMessage(bot: TelegramBot, msg: TelegramBot.Message) {
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

    // Получаем текущее состояние управления курьерами
    const courierManagementState = courierManagementStateManager.get(user.id);

    if (!courierManagementState) {
        return; // Нет состояния - не процесс управления курьерами
    }

    // Обработка в зависимости от шага
    if (courierManagementState.step === 'awaiting_courier_number') {
        // Пользователь ввел номер курьера
        const inputNumber = text.trim();

        if (!inputNumber) {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите номер курьера.'
            );
            return;
        }

        // Получаем список всех курьеров
        const couriers = await getAllCouriersForManagement();

        // Проверяем, является ли ввод числом (порядковым номером)
        const selectedIndex = parseInt(inputNumber);

        if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > couriers.length) {
            await bot.sendMessage(
                chatId,
                `❌ Неверный номер. Введите число от 1 до ${couriers.length}.\n` +
                `Пример: введите "1" для первого курьера в списке.`
            );
            return;
        }

        // Получаем выбранного курьера
        const selectedCourier = couriers[selectedIndex - 1];

        if (!selectedCourier) {
            await bot.sendMessage(
                chatId,
                '❌ Ошибка при выборе курьера. Попробуйте снова.'
            );
            return;
        }

        // Сохраняем данные о курьере
        courierManagementState.step = 'awaiting_action';
        courierManagementState.tempData = {
            courierId: selectedCourier.id,
            fullName: selectedCourier.full_name,
            phoneNumber: selectedCourier.phone_number,
            nickname: selectedCourier.nickname,
            isActive: selectedCourier.is_active
        };

        // Обновляем состояние
        courierManagementStateManager.set(user.id, courierManagementState);

        // Показываем кнопки действий
        const courierInfo = `👤 *Информация о курьере:*\n\n` +
            `*ФИО:* ${selectedCourier.full_name}\n` +
            `*Ник:* ${selectedCourier.nickname || 'не указан'}\n` +
            `*Телефон:* ${selectedCourier.phone_number}\n` +
            `*Статус:* ${selectedCourier.is_active ? '✅ Активен' : '❌ Отключен'}\n` +
            `*Активная сессия:* ${selectedCourier.has_active_session ? '🛴 Есть' : '🆓 Нет'}\n\n` +
            `*Выберите действие:*`;

        await bot.sendMessage(
            chatId,
            courierInfo,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [
                        [{ text: '❌ Отключить' }, { text: '🗑️ Удалить' }],
                        [{ text: '↩️ Назад' }, { text: '❌ Отмена' }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );

    } else if (courierManagementState.step === 'awaiting_action') {
        // Пользователь выбрал действие
        const courierId = courierManagementState.tempData?.courierId;
        const fullName = courierManagementState.tempData?.fullName;
        const phoneNumber = courierManagementState.tempData?.phoneNumber;

        if (!courierId || !fullName || !phoneNumber) {
            await bot.sendMessage(chatId, '❌ Ошибка: данные о курьере не найдены.');
            courierManagementStateManager.delete(user.id);
            return;
        }

        // Обработка действий
        if (text === '❌ Отключить') {
            const result = await disableCourier(courierId);
            await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });

        } else if (text === '🗑️ Удалить') {
            // Подтверждение удаления
            await bot.sendMessage(
                chatId,
                `⚠️ *Внимание! Вы уверены, что хотите удалить курьера?*\n\n` +
                `*ФИО:* ${fullName}\n` +
                `*Телефон:* ${phoneNumber}\n\n` +
                `Это действие может быть необратимо!\n\n` +
                `Для подтверждения введите "УДАЛИТЬ ${fullName.split(' ')[0]}"`,
                { parse_mode: 'Markdown' }
            );
            return;

        } else if (text === `УДАЛИТЬ ${fullName.split(' ')[0]}`) {
            // Подтвержденное удаление
            const result = await deleteCourier(courierId);
            await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });

        } else if (text === '↩️ Назад') {
            // Возврат к списку
            await handleManageCouriers(bot, msg);
            return;

        } else if (text === '❌ Отмена') {
            await bot.sendMessage(chatId, '❌ Управление курьерами отменено.');
            courierManagementStateManager.delete(user.id);
            return;

        } else {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, выберите действие из предложенных кнопок.'
            );
            return;
        }

        // Предлагаем продолжить
        await bot.sendMessage(
            chatId,
            `🔄 Хотите управлять другим курьером?\n\n` +
            `Нажмите "Управление курьерами" или введите /managecouriers`,
            Keyboards.adminPanel
        );

        // Удаляем состояние
        courierManagementStateManager.delete(user.id);
    }
}