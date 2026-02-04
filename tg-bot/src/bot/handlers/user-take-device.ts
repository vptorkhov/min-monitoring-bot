import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';

// Состояние для взятия СИМ
interface TakeDeviceState {
    step: 'awaiting_device_selection' | 'awaiting_confirmation' | 'completed';
    tempData?: {
        selectedDeviceId?: number;
        selectedDeviceNumber?: string;
        selectedDeviceType?: string;
    };
}

// Менеджер состояний для взятия СИМ
class TakeDeviceStateManager {
    private states = new Map<number, TakeDeviceState>();

    get(chatId: number): TakeDeviceState | undefined {
        return this.states.get(chatId);
    }

    set(chatId: number, state: TakeDeviceState): void {
        this.states.set(chatId, state);
    }

    delete(chatId: number): boolean {
        return this.states.delete(chatId);
    }
}

export const takeDeviceStateManager = new TakeDeviceStateManager();

// Проверяем, есть ли у курьера активная сессия
export async function hasActiveSession(courierId: number): Promise<boolean> {
    try {
        const result = await dbClient.query(
            'SELECT id FROM sessions WHERE courier_id = $1 AND end_date IS NULL',
            [courierId]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('❌ Ошибка проверки активной сессии:', error);
        return false;
    }
}

// Получаем список доступных СИМ для взятия
export async function getAvailableDevicesForUser(): Promise<Array<{
    id: number;
    device_number: string;
    device_type: string;
}>> {
    try {
        const result = await dbClient.query(
            `SELECT 
                md.id,
                md.device_number,
                md.device_type
             FROM mobility_devices md
             WHERE md.is_active = TRUE 
                AND md.is_personal = FALSE
                AND NOT EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.device_id = md.id AND s.end_date IS NULL
                )
             ORDER BY md.device_number`
        );

        return result.rows;
    } catch (error) {
        console.error('❌ Ошибка получения доступных СИМ:', error);
        return [];
    }
}

// Получаем информацию о курьере по Telegram ID
export async function getCourierByTelegramId(telegramId: number) {
    try {
        const result = await dbClient.query(
            `SELECT id, full_name, nickname 
             FROM couriers 
             WHERE nickname = $1 OR nickname LIKE $2
             LIMIT 1`,
            [telegramId.toString(), `%${telegramId}%`]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Ошибка получения курьера:', error);
        return null;
    }
}

// Получаем курьера по Telegram username
export async function getCourierByTelegramUsername(username: string) {
    try {
        const result = await dbClient.query(
            'SELECT id, full_name, nickname FROM couriers WHERE nickname = $1 LIMIT 1',
            [username]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Ошибка получения курьера по username:', error);
        return null;
    }
}

// Создаем новую сессию
export async function createSession(courierId: number, deviceId: number): Promise<{ success: boolean; message: string }> {
    try {
        // Проверяем, что курьер не имеет активной сессии
        const hasSession = await hasActiveSession(courierId);
        if (hasSession) {
            return {
                success: false,
                message: '❌ У вас уже есть активная сессия.\n' +
                    'Завершите текущую сессию перед началом новой.'
            };
        }

        // Проверяем, что устройство все еще доступно
        const deviceCheck = await dbClient.query(
            `SELECT 1 FROM mobility_devices md
             WHERE md.id = $1 
                AND md.is_active = TRUE
                AND NOT EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.device_id = md.id AND s.end_date IS NULL
                )`,
            [deviceId]
        );

        if (deviceCheck.rows.length === 0) {
            return {
                success: false,
                message: '❌ Это средство уже занято или недоступно.\n' +
                    'Пожалуйста, выберите другое средство.'
            };
        }

        // Создаем сессию
        const result = await dbClient.query(
            `INSERT INTO sessions (courier_id, device_id, start_date) 
             VALUES ($1, $2, NOW()) 
             RETURNING id`,
            [courierId, deviceId]
        );

        // Получаем информацию о курьере и устройстве
        const courierInfo = await dbClient.query(
            'SELECT full_name FROM couriers WHERE id = $1',
            [courierId]
        );

        const deviceInfo = await dbClient.query(
            'SELECT device_number, device_type FROM mobility_devices WHERE id = $1',
            [deviceId]
        );

        const courier = courierInfo.rows[0];
        const device = deviceInfo.rows[0];

        console.log(`✅ Новая сессия: ${courier.full_name} взял ${device.device_number} (ID: ${result.rows[0].id})`);

        return {
            success: true,
            message: `🎉 *Сессия успешно начата!*\n\n` +
                `👤 *Курьер:* ${courier.full_name}\n` +
                `🛴 *Средство:* ${device.device_number} (${device.device_type})\n` +
                `⏰ *Начало:* ${new Date().toLocaleString('ru-RU')}\n\n` +
                `Теперь вы можете использовать это средство.\n` +
                `Не забудьте завершить сессию после работы!`
        };
    } catch (error: any) {
        console.error('❌ Ошибка создания сессии:', error);
        return {
            success: false,
            message: `❌ Ошибка при начале сессии: ${error.message || 'Неизвестная ошибка'}`
        };
    }
}

// Обработчик команды для взятия СИМ
export async function handleTakeDevice(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`🎯 Запрос на взятие СИМ от ${user.first_name || 'пользователь'} (ID: ${user.id}, Username: ${user.username || 'нет'})`);

    // Ищем курьера в базе данных
    let courier = null;

    if (user.username) {
        courier = await getCourierByTelegramUsername(user.username);
    }

    if (!courier) {
        // Пробуем найти по ID
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

    // Проверяем, есть ли уже активная сессия
    const hasSession = await hasActiveSession(courier.id);

    if (hasSession) {
        await bot.sendMessage(
            chatId,
            '❌ У вас уже есть активная сессия.\n\n' +
            'Завершите текущую сессию перед началом новой.\n' +
            'Используйте команду /endsession для завершения.'
        );
        return;
    }

    // Получаем список доступных СИМ
    const availableDevices = await getAvailableDevicesForUser();

    if (availableDevices.length === 0) {
        await bot.sendMessage(
            chatId,
            '📭 К сожалению, сейчас нет доступных средств.\n\n' +
            'Попробуйте позже или обратитесь к администратору.'
        );
        return;
    }

    // Формируем список доступных СИМ
    let devicesText = `🛴 *Выберите средство для начала работы*\n\n`;
    devicesText += `📋 *Доступные средства (${availableDevices.length}):*\n\n`;

    availableDevices.forEach((device, index) => {
        devicesText += `*${index + 1}. ${device.device_number}* - ${device.device_type}\n`;
    });

    devicesText += `\n✏️ *Инструкция:*\n`;
    devicesText += `Введите *номер средства* из списка (1, 2, 3...)\n\n`;
    devicesText += `*Пример:* введите "1" для первого средства\n\n`;
    devicesText += `*Введите номер:*`;

    await bot.sendMessage(chatId, devicesText, { parse_mode: 'Markdown' });

    // Устанавливаем состояние ожидания выбора
    takeDeviceStateManager.set(chatId, {
        step: 'awaiting_device_selection'
    });
}

// Обработчик кнопки "Хочу взять СИМ"
export async function handleTakeDeviceButton(bot: TelegramBot, msg: TelegramBot.Message) {
    await handleTakeDevice(bot, msg);
}

// Обработчик текстовых сообщений для взятия СИМ
export async function handleTakeDeviceMessage(bot: TelegramBot, msg: TelegramBot.Message) {
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

    // Получаем текущее состояние взятия СИМ
    const takeDeviceState = takeDeviceStateManager.get(chatId);

    if (!takeDeviceState) {
        return; // Нет состояния - не процесс взятия СИМ
    }

    // Ищем курьера
    let courier = null;
    if (user.username) {
        courier = await getCourierByTelegramUsername(user.username);
    }
    if (!courier) {
        courier = await getCourierByTelegramId(user.id);
    }

    if (!courier) {
        await bot.sendMessage(chatId, '❌ Ошибка: курьер не найден.');
        takeDeviceStateManager.delete(chatId);
        return;
    }

    // Обработка в зависимости от шага
    if (takeDeviceState.step === 'awaiting_device_selection') {
        // Пользователь ввел номер средства
        const inputNumber = text.trim();

        if (!inputNumber) {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите номер средства.'
            );
            return;
        }

        // Получаем список доступных СИМ
        const availableDevices = await getAvailableDevicesForUser();

        // Проверяем, является ли ввод числом (порядковым номером)
        const selectedIndex = parseInt(inputNumber);

        if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > availableDevices.length) {
            await bot.sendMessage(
                chatId,
                `❌ Неверный номер. Введите число от 1 до ${availableDevices.length}.\n` +
                `Пример: введите "1" для первого средства в списке.`
            );
            return;
        }

        // Получаем выбранное устройство
        const selectedDevice = availableDevices[selectedIndex - 1];

        if (!selectedDevice) {
            await bot.sendMessage(
                chatId,
                '❌ Ошибка при выборе средства. Попробуйте снова.'
            );
            return;
        }

        // Сохраняем данные об устройстве
        takeDeviceState.step = 'awaiting_confirmation';
        takeDeviceState.tempData = {
            selectedDeviceId: selectedDevice.id,
            selectedDeviceNumber: selectedDevice.device_number,
            selectedDeviceType: selectedDevice.device_type
        };

        // Обновляем состояние
        takeDeviceStateManager.set(chatId, takeDeviceState);

        // Запрашиваем подтверждение
        const confirmationText = `✅ *Вы выбрали:* ${selectedDevice.device_number} (${selectedDevice.device_type})\n\n` +
            `👤 *Вы:* ${courier.full_name}\n` +
            `📅 *Дата:* ${new Date().toLocaleDateString('ru-RU')}\n\n` +
            `*Подтвердите начало сессии:*\n` +
            `Введите "ДА" для подтверждения\n` +
            `Или "НЕТ" для отмены`;

        await bot.sendMessage(
            chatId,
            confirmationText,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [
                        [{ text: '✅ ДА' }, { text: '❌ НЕТ' }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );

    } else if (takeDeviceState.step === 'awaiting_confirmation') {
        // Пользователь подтверждает или отменяет
        const deviceId = takeDeviceState.tempData?.selectedDeviceId;
        const deviceNumber = takeDeviceState.tempData?.selectedDeviceNumber;
        const deviceType = takeDeviceState.tempData?.selectedDeviceType;

        if (!deviceId || !deviceNumber || !deviceType) {
            await bot.sendMessage(chatId, '❌ Ошибка: данные об устройстве не найдены.');
            takeDeviceStateManager.delete(chatId);
            return;
        }

        if (text.toUpperCase() === 'ДА' || text.toUpperCase() === 'YES' || text === '✅ ДА') {
            // Подтверждение - создаем сессию
            const result = await createSession(courier.id, deviceId);

            await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });

            if (result.success) {
                // Показываем кнопки для управления сессией
                await bot.sendMessage(
                    chatId,
                    `🔄 *Что дальше?*\n\n` +
                    `• Используйте средство по назначению\n` +
                    `• Завершите сессию после работы\n` +
                    `• Если возникли проблемы - обратитесь к администратору`,
                    {
                        reply_markup: {
                            keyboard: [
                                [{ text: '⏹️ Завершить сессию' }, { text: '📱 Мой профиль' }],
                                [{ text: '✅ Свободные средства' }, { text: '❓ Помощь' }]
                            ],
                            resize_keyboard: true
                        }
                    }
                );
            }

        } else if (text.toUpperCase() === 'НЕТ' || text.toUpperCase() === 'NO' || text === '❌ НЕТ') {
            // Отмена
            await bot.sendMessage(
                chatId,
                '❌ Начало сессии отменено.\n\n' +
                'Вы можете выбрать другое средство позже.'
            );

            // Предлагаем попробовать снова
            await bot.sendMessage(
                chatId,
                '🔄 Хотите выбрать другое средство?\n\n' +
                'Нажмите "Хочу взять СИМ" или введите /takedevice',
                {
                    reply_markup: {
                        keyboard: [
                            [{ text: '🛴 Хочу взять СИМ' }, { text: '📱 Мой профиль' }],
                            [{ text: '✅ Свободные средства' }, { text: '❓ Помощь' }]
                        ],
                        resize_keyboard: true
                    }
                }
            );

        } else {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите "ДА" для подтверждения или "НЕТ" для отмены.'
            );
            return;
        }

        // Удаляем состояние
        takeDeviceStateManager.delete(chatId);
    }
}