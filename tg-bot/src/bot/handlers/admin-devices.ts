import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';
import { isAdmin } from './admin';
import { Keyboards } from '../keyboards';

// Состояние для добавления СИМ
interface AddDeviceState {
    step: 'awaiting_type' | 'awaiting_number' | 'completed';
    tempData?: {
        deviceType?: string;
        deviceNumber?: string;
    };
}

// Менеджер состояний для добавления СИМ
class AddDeviceStateManager {
    private states = new Map<number, AddDeviceState>();

    get(telegramId: number): AddDeviceState | undefined {
        return this.states.get(telegramId);
    }

    set(telegramId: number, state: AddDeviceState): void {
        this.states.set(telegramId, state);
    }

    delete(telegramId: number): boolean {
        return this.states.delete(telegramId);
    }

    clearExpiredStates(timeoutMinutes: number = 10): void {
        // Автоматическая очистка старых состояний
        const now = Date.now();
        const timeout = timeoutMinutes * 60 * 1000;

        for (const [telegramId, state] of this.states.entries()) {
            // Можно добавить timestamp в состояние для очистки
        }
    }
}

export const addDeviceStateManager = new AddDeviceStateManager();

// Добавляем новое средство в базу данных
export async function addDeviceToDatabase(
    deviceType: string,
    deviceNumber: string
): Promise<{ success: boolean; message: string }> {
    try {
        // Проверяем, существует ли уже средство с таким номером
        const checkResult = await dbClient.query(
            'SELECT id FROM mobility_devices WHERE device_number = $1',
            [deviceNumber]
        );

        if (checkResult.rows.length > 0) {
            return {
                success: false,
                message: `СИМ с номером "${deviceNumber}" уже существует в базе данных.`
            };
        }

        // Добавляем новое средство
        const result = await dbClient.query(
            `INSERT INTO mobility_devices (
                device_type, 
                device_number, 
                is_personal, 
                is_active
            ) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id`,
            [deviceType, deviceNumber.toUpperCase(), false, true]
        );

        console.log(`✅ Добавлено новое СИМ: ${deviceType} ${deviceNumber} (ID: ${result.rows[0].id})`);

        return {
            success: true,
            message: `✅ СИМ успешно добавлено!\n\n` +
                `*Тип:* ${deviceType}\n` +
                `*Номер:* ${deviceNumber.toUpperCase()}\n` +
                `*Статус:* Активно, доступно для использования`
        };
    } catch (error: any) {
        console.error('❌ Ошибка при добавлении СИМ:', error);

        return {
            success: false,
            message: `❌ Ошибка при добавлении СИМ: ${error.message || 'Неизвестная ошибка'}`
        };
    }
}

// Обработчик команды для добавления СИМ
export async function handleAddDevice(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`🎯 Запрос на добавление СИМ от ${user.first_name || 'пользователь'} (ID: ${user.id})`);

    // Проверяем, является ли пользователь администратором
    const userIsAdmin = await isAdmin(user.id);

    if (!userIsAdmin) {
        await bot.sendMessage(
            chatId,
            '⛔ У вас нет прав для выполнения этой команды.\n' +
            'Только администраторы могут добавлять СИМ.'
        );
        return;
    }

    // Начинаем процесс добавления СИМ
    const welcomeText = `🛴 *Добавление нового средства индивидуальной мобильности*\n\n` +
        `Пожалуйста, введите *тип средства* (например):\n` +
        `• Электросамокат\n` +
        `• Электроскутер\n` +
        `• Электровелосипед\n` +
        `• Гироскутер\n` +
        `• Моноколесо\n\n` +
        `Или введите свой вариант:`;

    await bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });

    // Устанавливаем состояние ожидания типа
    addDeviceStateManager.set(user.id, {
        step: 'awaiting_type'
    });

    console.log(`✅ Установлено состояние добавления СИМ для пользователя ${user.id}: awaiting_type`);
}

// Обработчик кнопки "Добавить СИМ"
export async function handleAddDeviceButton(bot: TelegramBot, msg: TelegramBot.Message) {
    // Аналогично команде, но можно добавить специфичную логику для кнопок
    await handleAddDevice(bot, msg);
}

// Обработчик текстовых сообщений для добавления СИМ
export async function handleAddDeviceMessage(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const user = msg.from;

    if (!user) {
        return;
    }

    console.log(`📝 Обработка сообщения для добавления СИМ: "${text}" от ${user.id}`);

    // Пропускаем команды
    if (text.startsWith('/')) {
        return;
    }

    // Получаем текущее состояние добавления СИМ
    const deviceState = addDeviceStateManager.get(user.id);

    console.log(`🔍 Состояние устройства для ${user.id}:`, deviceState);

    if (!deviceState) {
        console.log(`❌ Нет состояния добавления СИМ для ${user.id}`);
        return; // Нет состояния - не процесс добавления СИМ
    }

    // Обработка в зависимости от шага
    if (deviceState.step === 'awaiting_type') {
        console.log(`📝 Шаг awaiting_type для ${user.id}`);
        // Пользователь ввел тип средства
        const deviceType = text.trim();

        if (!deviceType) {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите тип средства.'
            );
            return;
        }

        // Сохраняем тип и запрашиваем номер
        deviceState.step = 'awaiting_number';
        deviceState.tempData = { deviceType };

        // Обновляем состояние
        addDeviceStateManager.set(user.id, deviceState);

        console.log(`✅ Сохранен тип: ${deviceType}, установлен шаг awaiting_number для ${user.id}`);

        await bot.sendMessage(
            chatId,
            `✅ Тип сохранен: *${deviceType}*\n\n` +
            `Теперь введите *номер средства* (например: РЕ026Р):\n\n` +
            `📝 *Формат:* Буквы и цифры, например:\n` +
            `• РЕ026Р\n` +
            `• МО123А\n` +
            `• СИ456Б`,
            { parse_mode: 'Markdown' }
        );

    } else if (deviceState.step === 'awaiting_number') {
        console.log(`📝 Шаг awaiting_number для ${user.id}, tempData:`, deviceState.tempData);
        // Пользователь ввел номер средства
        const deviceNumber = text.trim().toUpperCase();

        if (!deviceNumber) {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите номер средства.'
            );
            return;
        }

        // Проверяем формат номера (примерная проверка)
        const numberRegex = /^[А-ЯA-Z]{2}\d{3}[А-ЯA-Z]$/;
        if (!numberRegex.test(deviceNumber)) {
            await bot.sendMessage(
                chatId,
                `⚠️ Неверный формат номера.\n\n` +
                `📝 *Правильный формат:* 2 буквы, 3 цифры, 1 буква\n` +
                `*Пример:* РЕ026Р, МО123А, СИ456Б\n\n` +
                `Пожалуйста, введите номер в правильном формате:`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Сохраняем номер и добавляем в базу данных
        const deviceType = deviceState.tempData?.deviceType || 'Неизвестный тип';

        console.log(`🔄 Попытка добавления СИМ: ${deviceType} ${deviceNumber}`);

        const result = await addDeviceToDatabase(deviceType, deviceNumber);

        // Отправляем результат
        await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });

        // Удаляем состояние
        addDeviceStateManager.delete(user.id);
        console.log(`🗑️ Удалено состояние добавления СИМ для ${user.id}`);

        // Если успешно, предлагаем добавить еще
        if (result.success) {
            await bot.sendMessage(
                chatId,
                `🔄 Хотите добавить еще одно средство?\n\n` +
                `Нажмите "Добавить СИМ" или введите /adddevice`,
                Keyboards.afterDeviceAdd
            );
        }
    }
}

// Команда для просмотра всех СИМ
export async function handleListDevices(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    try {
        // Получаем все активные средства
        const result = await dbClient.query(
            `SELECT device_type, device_number, is_personal, 
                    CASE 
                        WHEN is_personal THEN 'Личное'
                        ELSE 'Компании'
                    END as ownership,
                    CASE 
                        WHEN is_personal THEN 'Н/Д'
                        WHEN EXISTS (
                            SELECT 1 FROM sessions s 
                            WHERE s.device_id = md.id AND s.end_date IS NULL
                        ) THEN 'Занято'
                        ELSE 'Свободно'
                    END as status
             FROM mobility_devices md
             WHERE is_active = TRUE
             ORDER BY is_personal DESC, device_type, device_number`
        );

        if (result.rows.length === 0) {
            await bot.sendMessage(
                chatId,
                '📭 В базе данных нет средств индивидуальной мобильности.'
            );
            return;
        }

        let devicesText = `📋 *Список всех СИМ (${result.rows.length}):*\n\n`;

        result.rows.forEach((device, index) => {
            devicesText += `*${index + 1}. ${device.device_type} ${device.device_number}*\n`;
            devicesText += `   • Принадлежность: ${device.ownership}\n`;
            devicesText += `   • Статус: ${device.status}\n\n`;
        });

        // Добавляем статистику
        const statsResult = await dbClient.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_personal THEN 1 ELSE 0 END) as personal,
                SUM(CASE WHEN NOT is_personal THEN 1 ELSE 0 END) as company,
                SUM(CASE WHEN NOT is_personal AND EXISTS (
                    SELECT 1 FROM sessions s 
                    WHERE s.device_id = md.id AND s.end_date IS NULL
                ) THEN 1 ELSE 0 END) as busy
             FROM mobility_devices md
             WHERE is_active = TRUE`
        );

        const stats = statsResult.rows[0];
        devicesText += `📊 *Статистика:*\n`;
        devicesText += `   • Всего: ${stats.total}\n`;
        devicesText += `   • Личные: ${stats.personal}\n`;
        devicesText += `   • Компании: ${stats.company}\n`;
        devicesText += `   • Занято: ${stats.busy || 0}\n`;
        devicesText += `   • Свободно: ${stats.company - (stats.busy || 0)}`;

        await bot.sendMessage(chatId, devicesText, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('❌ Ошибка при получении списка СИМ:', error);
        await bot.sendMessage(
            chatId,
            '❌ Ошибка при получении списка средств. Попробуйте позже.'
        );
    }
}

// Клавиатура для администратора
export const adminDeviceKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '🛴 Добавить СИМ' }, { text: '📋 Все СИМ' }],
            [{ text: '👥 Управление курьерами' }, { text: '📊 Статистика' }],
            [{ text: '⚙️ Админ-панель' }, { text: '❓ Помощь' }]
        ],
        resize_keyboard: true
    }
};