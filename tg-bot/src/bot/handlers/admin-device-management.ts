import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';
import { isAdmin } from './admin';
import { Keyboards } from '../keyboards';

// Состояние для управления СИМ
interface DeviceManagementState {
    step: 'awaiting_device_number' | 'awaiting_action' | 'completed';
    tempData?: {
        deviceNumber?: string;
        deviceId?: number;
        deviceType?: string;
        isActive?: boolean;
    };
}

// Менеджер состояний для управления СИМ
class DeviceManagementStateManager {
    private states = new Map<number, DeviceManagementState>();

    get(telegramId: number): DeviceManagementState | undefined {
        return this.states.get(telegramId);
    }

    set(telegramId: number, state: DeviceManagementState): void {
        this.states.set(telegramId, state);
    }

    delete(telegramId: number): boolean {
        return this.states.delete(telegramId);
    }

    clearExpiredStates(timeoutMinutes: number = 10): void {
        // Автоматическая очистка старых состояний
    }
}

export const deviceManagementStateManager = new DeviceManagementStateManager();

// Получаем список всех СИМ (кроме личного)
export async function getAllDevicesForManagement(): Promise<Array<{
    id: number;
    device_number: string;
    device_type: string;
    is_active: boolean;
    status: string;
}>> {
    try {
        const result = await dbClient.query(
            `SELECT 
                md.id,
                md.device_number,
                md.device_type,
                md.is_active,
                CASE 
                    WHEN md.is_personal THEN 'Личное'
                    WHEN NOT EXISTS (
                        SELECT 1 FROM sessions s 
                        WHERE s.device_id = md.id AND s.end_date IS NULL
                    ) THEN 'Свободно'
                    ELSE 'Занято'
                END as status
             FROM mobility_devices md
             WHERE md.is_personal = FALSE
             ORDER BY md.device_number`
        );

        return result.rows;
    } catch (error) {
        console.error('❌ Ошибка получения списка СИМ:', error);
        return [];
    }
}

// Отключаем СИМ (меняем is_active на false)
export async function disableDevice(deviceId: number): Promise<{ success: boolean; message: string }> {
    try {
        // Проверяем, занято ли средство
        const checkSession = await dbClient.query(
            'SELECT id FROM sessions WHERE device_id = $1 AND end_date IS NULL',
            [deviceId]
        );

        if (checkSession.rows.length > 0) {
            return {
                success: false,
                message: '❌ Невозможно отключить средство: оно используется в активной сессии.\n' +
                    'Завершите сессию сначала.'
            };
        }

        // Отключаем средство
        await dbClient.query(
            'UPDATE mobility_devices SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
            [deviceId]
        );

        // Получаем информацию об отключенном средстве
        const deviceInfo = await dbClient.query(
            'SELECT device_number, device_type FROM mobility_devices WHERE id = $1',
            [deviceId]
        );

        const device = deviceInfo.rows[0];

        return {
            success: true,
            message: `✅ Средство успешно отключено!\n\n` +
                `*Номер:* ${device.device_number}\n` +
                `*Тип:* ${device.device_type}\n` +
                `*Статус:* ❌ Отключено\n\n` +
                `Теперь это средство не будет отображаться в списках доступных.`
        };
    } catch (error: any) {
        console.error('❌ Ошибка при отключении СИМ:', error);
        return {
            success: false,
            message: `❌ Ошибка при отключении СИМ: ${error.message || 'Неизвестная ошибка'}`
        };
    }
}

// Удаляем СИМ из базы данных
export async function deleteDevice(deviceId: number): Promise<{ success: boolean; message: string }> {
    try {
        // Проверяем, занято ли средство
        const checkSession = await dbClient.query(
            'SELECT id FROM sessions WHERE device_id = $1 AND end_date IS NULL',
            [deviceId]
        );

        if (checkSession.rows.length > 0) {
            return {
                success: false,
                message: '❌ Невозможно удалить средство: оно используется в активной сессии.\n' +
                    'Завершите сессию сначала.'
            };
        }

        // Проверяем, есть ли история сессий с этим средством
        const checkHistory = await dbClient.query(
            'SELECT id FROM sessions WHERE device_id = $1 LIMIT 1',
            [deviceId]
        );

        // Получаем информацию об удаляемом средстве
        const deviceInfo = await dbClient.query(
            'SELECT device_number, device_type FROM mobility_devices WHERE id = $1',
            [deviceId]
        );

        const device = deviceInfo.rows[0];

        if (checkHistory.rows.length > 0) {
            // Если есть история, только отключаем
            await dbClient.query(
                'UPDATE mobility_devices SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
                [deviceId]
            );

            return {
                success: true,
                message: `⚠️ Средство имеет историю сессий, поэтому было отключено вместо удаления.\n\n` +
                    `*Номер:* ${device.device_number}\n` +
                    `*Тип:* ${device.device_type}\n` +
                    `*Статус:* ❌ Отключено\n\n` +
                    `Данные о сессиях сохранены для отчетности.`
            };
        }

        // Если нет истории - удаляем полностью
        await dbClient.query('DELETE FROM mobility_devices WHERE id = $1', [deviceId]);

        return {
            success: true,
            message: `🗑️ Средство успешно удалено из базы данных!\n\n` +
                `*Номер:* ${device.device_number}\n` +
                `*Тип:* ${device.device_type}\n\n` +
                `Все данные о средстве полностью удалены.`
        };
    } catch (error: any) {
        console.error('❌ Ошибка при удалении СИМ:', error);
        return {
            success: false,
            message: `❌ Ошибка при удалении СИМ: ${error.message || 'Неизвестная ошибка'}`
        };
    }
}

// Обработчик команды для управления СИМ
export async function handleManageDevices(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`🎯 Запрос на управление СИМ от ${user.first_name || 'пользователь'} (ID: ${user.id})`);

    // Проверяем, является ли пользователь администратором
    const userIsAdmin = await isAdmin(user.id);

    if (!userIsAdmin) {
        await bot.sendMessage(
            chatId,
            '⛔ У вас нет прав для выполнения этой команды.\n' +
            'Только администраторы могут управлять СИМ.'
        );
        return;
    }

    // Получаем список всех СИМ
    const devices = await getAllDevicesForManagement();

    if (devices.length === 0) {
        await bot.sendMessage(
            chatId,
            '📭 В базе данных нет средств индивидуальной мобильности для управления.\n' +
            'Добавьте средства сначала.'
        );
        return;
    }

    // Формируем список СИМ
    let devicesText = `🛠️ *Управление средствами индивидуальной мобильности*\n\n`;
    devicesText += `📋 *Список всех СИМ (${devices.length}):*\n\n`;

    devices.forEach((device, index) => {
        const statusIcon = device.is_active ? '✅' : '❌';
        devicesText += `*${index + 1}. ${device.device_number}* - ${device.device_type}\n`;
        devicesText += `   • Статус: ${statusIcon} ${device.status}\n`;
        devicesText += `   • Активно: ${device.is_active ? 'Да' : 'Нет'}\n\n`;
    });

    devicesText += `✏️ *Инструкция:*\n`;
    devicesText += `Введите *порядковый номер* средства из списка (1, 2, 3...)\n\n`;
    devicesText += `*Пример:* введите "1" для первого средства\n\n`;
    devicesText += `*Введите номер:*`;

    await bot.sendMessage(chatId, devicesText, { parse_mode: 'Markdown' });

    // Устанавливаем состояние ожидания номера
    deviceManagementStateManager.set(user.id, {
        step: 'awaiting_device_number'
    });
}

// Обработчик кнопки "Управление СИМ"
export async function handleManageDevicesButton(bot: TelegramBot, msg: TelegramBot.Message) {
    await handleManageDevices(bot, msg);
}

// Обработчик текстовых сообщений для управления СИМ
export async function handleDeviceManagementMessage(bot: TelegramBot, msg: TelegramBot.Message) {
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

    // Получаем текущее состояние управления СИМ
    const deviceManagementState = deviceManagementStateManager.get(user.id);

    if (!deviceManagementState) {
        return; // Нет состояния - не процесс управления СИМ
    }

    // Обработка в зависимости от шага
    if (deviceManagementState.step === 'awaiting_device_number') {
        // Пользователь ввел номер средства
        const inputNumber = text.trim();

        if (!inputNumber) {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите номер средства.'
            );
            return;
        }

        // Получаем список всех СИМ
        const devices = await getAllDevicesForManagement();

        // Проверяем, является ли ввод числом (порядковым номером)
        const selectedIndex = parseInt(inputNumber);

        if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > devices.length) {
            await bot.sendMessage(
                chatId,
                `❌ Неверный номер. Введите число от 1 до ${devices.length}.\n` +
                `Пример: введите "1" для первого средства в списке.`
            );
            return;
        }

        // Получаем выбранное устройство
        const selectedDevice = devices[selectedIndex - 1];

        if (!selectedDevice) {
            await bot.sendMessage(
                chatId,
                '❌ Ошибка при выборе средства. Попробуйте снова.'
            );
            return;
        }

        // Сохраняем данные о средстве
        deviceManagementState.step = 'awaiting_action';
        deviceManagementState.tempData = {
            deviceNumber: selectedDevice.device_number,
            deviceId: selectedDevice.id,
            deviceType: selectedDevice.device_type,
            isActive: selectedDevice.is_active
        };

        // Обновляем состояние
        deviceManagementStateManager.set(user.id, deviceManagementState);

        // Показываем кнопки действий
        const deviceInfo = `🔍 *Информация о средстве:*\n\n` +
            `*Номер:* ${selectedDevice.device_number}\n` +
            `*Тип:* ${selectedDevice.device_type}\n` +
            `*Статус:* ${selectedDevice.is_active ? '✅ Активно' : '❌ Отключено'}\n` +
            `*Доступность:* ${selectedDevice.status}\n\n` +
            `*Выберите действие:*`;

        await bot.sendMessage(
            chatId,
            deviceInfo,
            {
                parse_mode: 'Markdown',
                ...Keyboards.deviceActions
            }
        );

    } else if (deviceManagementState.step === 'awaiting_action') {
        // Обработка выбранного действия (остается без изменений)
        const deviceId = deviceManagementState.tempData?.deviceId;
        const deviceNumber = deviceManagementState.tempData?.deviceNumber;
        const deviceType = deviceManagementState.tempData?.deviceType;

        if (!deviceId || !deviceNumber || !deviceType) {
            await bot.sendMessage(chatId, '❌ Ошибка: данные о средстве не найдены.');
            deviceManagementStateManager.delete(user.id);
            return;
        }

        // Обработка действий
        if (text === '❌ Отключить') {
            const result = await disableDevice(deviceId);
            await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });

        } else if (text === '🗑️ Удалить') {
            // Подтверждение удаления
            await bot.sendMessage(
                chatId,
                `⚠️ *Внимание! Вы уверены, что хотите удалить средство?*\n\n` +
                `*Номер:* ${deviceNumber}\n` +
                `*Тип:* ${deviceType}\n\n` +
                `Это действие может быть необратимо!\n\n` +
                `Для подтверждения введите "УДАЛИТЬ ${deviceNumber}"`,
                { parse_mode: 'Markdown' }
            );
            return;

        } else if (text === `УДАЛИТЬ ${deviceNumber}`) {
            // Подтвержденное удаление
            const result = await deleteDevice(deviceId);
            await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });

        } else if (text === '↩️ Назад') {
            // Возврат к списку
            await handleManageDevices(bot, msg);
            return;

        } else if (text === '❌ Отмена') {
            await bot.sendMessage(chatId, '❌ Управление СИМ отменено.');
            deviceManagementStateManager.delete(user.id);
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
            `🔄 Хотите управлять другим средством?\n\n` +
            `Нажмите "Управление СИМ" или введите /managedevices`,
            Keyboards.deviceManagement
        );

        // Удаляем состояние
        deviceManagementStateManager.delete(user.id);
    }
}

// Клавиатура для управления устройствами
export const deviceManagementKeyboard = {
    keyboard: [
        [{ text: '🛠️ Управление СИМ' }, { text: '📋 Все СИМ' }],
        [{ text: '🛴 Добавить СИМ' }, { text: '⚙️ Админ-панель' }],
        [{ text: '❓ Помощь' }, { text: '🏠 Главная' }]
    ],
    resize_keyboard: true
} as TelegramBot.ReplyKeyboardMarkup;