import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';
import { config } from '../../config';
import { Keyboards } from '../keyboards';

// Интерфейс для состояния администратора
export interface AdminState {
    step: 'awaiting_password' | 'awaiting_name' | 'registered';
    tempData?: {
        password?: string;
        fullName?: string;
    };
}

// Менеджер состояний администратора
class AdminStateManager {
    private adminStates = new Map<number, AdminState>();

    get(telegramId: number): AdminState | undefined {
        return this.adminStates.get(telegramId);
    }

    set(telegramId: number, state: AdminState): void {
        this.adminStates.set(telegramId, state);
    }

    delete(telegramId: number): boolean {
        return this.adminStates.delete(telegramId);
    }

    clearExpiredStates(timeoutMinutes: number = 10): void {
        // Автоматическая очистка старых состояний (можно реализовать позже)
    }
}

export const adminStateManager = new AdminStateManager();

// Проверяем, является ли пользователь администратором
export async function isAdmin(telegramId: number): Promise<boolean> {
    try {
        console.log(`🔍 Проверка администратора для ID: ${telegramId}`);
        const result = await dbClient.query(
            'SELECT id FROM admins WHERE telegram_id = $1 AND is_active = true',
            [telegramId.toString()]
        );
        const isAdmin = result.rows.length > 0;
        console.log(`📊 Результат проверки администратора для ${telegramId}: ${isAdmin}`);
        return isAdmin;
    } catch (error) {
        console.error('❌ Ошибка проверки администратора:', error);
        return false;
    }
}

// Получаем информацию об администраторе
export async function getAdminInfo(telegramId: number) {
    try {
        const result = await dbClient.query(
            `SELECT id, telegram_username, full_name, added_at, 
                    permissions_level, is_active, notes
             FROM admins 
             WHERE telegram_id = $1`,
            [telegramId.toString()]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Ошибка получения информации об администраторе:', error);
        return null;
    }
}

// Регистрируем нового администратора
export async function registerAdmin(
    telegramId: number,
    telegramUsername: string | undefined,
    fullName: string,
    addedBy?: number
): Promise<boolean> {
    try {
        // Проверяем, не является ли пользователь уже администратором
        const existingAdmin = await isAdmin(telegramId);
        if (existingAdmin) {
            console.log(`⚠️ Пользователь ${telegramId} уже является администратором`);
            return false;
        }

        // Преобразуем undefined в null для базы данных
        const usernameForDb = telegramUsername || null;

        // Добавляем администратора в базу данных
        const result = await dbClient.query(
            `INSERT INTO admins (
                telegram_id, 
                telegram_username, 
                full_name, 
                added_by,
                permissions_level,
                is_active
            ) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id`,
            [
                telegramId.toString(),
                usernameForDb,
                fullName,
                addedBy || null,
                1, // Базовый уровень прав
                true
            ]
        );

        console.log(`✅ Зарегистрирован новый администратор: ${fullName} (Telegram ID: ${telegramId})`);
        return true;
    } catch (error: any) {
        console.error('❌ Ошибка регистрации администратора:', error);

        if (error.code === '23505') { // Unique violation
            console.error('⛔ Такой администратор уже существует');
        }

        return false;
    }
}

// Обработчик команды /admin
export async function handleAdmin(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`🎯 Команда /admin от ${user.first_name || 'пользователь'} (ID: ${user.id})`);

    // Проверяем, является ли пользователь уже администратором
    const isUserAdmin = await isAdmin(user.id);

    if (isUserAdmin) {
        // Если администратор, показываем панель
        const adminInfo = await getAdminInfo(user.id);

        const adminText = `⚙️ *Панель администратора*\n\n` +
            `👤 *Ваши данные:*\n` +
            `• ID: ${user.id}\n` +
            `• Username: ${user.username ? `@${user.username}` : 'не указан'}\n` +
            `• ФИО: ${adminInfo?.full_name || 'не указано'}\n` +
            `• Уровень прав: ${adminInfo?.permissions_level || 1}\n` +
            `• Дата добавления: ${adminInfo ? new Date(adminInfo.added_at).toLocaleDateString('ru-RU') : 'неизвестно'}\n\n` +
            `🛠️ *Доступные действия:*\n` +
            `• Добавление/управление СИМ\n` +
            `• Просмотр списка курьеров\n` +
            `• Просмотр статистики\n` +
            `• Управление сессиями\n\n` +
            `Используйте кнопки ниже или команды:`;

        await bot.sendMessage(chatId, adminText, {
            parse_mode: 'Markdown',
            ...Keyboards.adminPanel
        });
    } else {
        // Если не администратор, начинаем процесс регистрации
        const adminPassword = config.ADMIN_PASSWORD || 'admin123';

        const registerText = `🔐 *Регистрация администратора*\n\n` +
            `Для доступа к панели администратора требуется пароль.\n\n` +
            `Пожалуйста, введите пароль администратора:`;

        await bot.sendMessage(chatId, registerText, { parse_mode: 'Markdown' });

        // Устанавливаем состояние ожидания пароля
        adminStateManager.set(user.id, {
            step: 'awaiting_password'
        });
    }
}

// Обработчик текстовых сообщений для регистрации администратора
export async function handleAdminRegistrationMessage(bot: TelegramBot, msg: TelegramBot.Message) {
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

    // Получаем текущее состояние администратора
    const adminState = adminStateManager.get(user.id);

    if (!adminState) {
        return; // Нет состояния - не процесс регистрации администратора
    }

    // Обработка в зависимости от шага
    if (adminState.step === 'awaiting_password') {
        const adminPassword = config.ADMIN_PASSWORD || 'admin123';

        // Проверяем пароль
        if (text.trim() !== adminPassword) {
            await bot.sendMessage(
                chatId,
                '❌ Неверный пароль. Попробуйте еще раз или отмените командой /cancel'
            );
            return; // ← ДОБАВИТЬ ЭТУ СТРОКУ!
        }

        // Пароль верный, запрашиваем ФИО
        adminState.step = 'awaiting_name';
        adminState.tempData = { password: text.trim() };

        await bot.sendMessage(
            chatId,
            `✅ Пароль принят!\n\n` +
            `Теперь введите ваше *ФИО* для регистрации как администратор:`,
            { parse_mode: 'Markdown' }
        );

    } else if (adminState.step === 'awaiting_name') {
        // Пользователь ввел ФИО
        if (text.trim().split(' ').length < 2) {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите полное ФИО (например: Иванов Иван Иванович).\n' +
                'Должно быть минимум 2 слова:'
            );
            return;
        }

        // Регистрируем администратора
        const registrationSuccess = await registerAdmin(
            user.id,
            user.username,
            text.trim()
        );

        if (registrationSuccess) {
            adminState.step = 'registered';

            const successText = `🎉 *Регистрация администратора успешно завершена!*\n\n` +
                `*ФИО:* ${text.trim()}\n` +
                `*Telegram:* ${user.username ? `@${user.username}` : 'не указан'}\n` +
                `*ID:* ${user.id}\n\n` +
                `Теперь у вас есть доступ к панели администратора.\n` +
                `Используйте команду /admin для доступа к функциям.\n\n` +
                `⚠️ *Важно:* Сохраните этот пароль в надежном месте.`;

            await bot.sendMessage(chatId, successText, { parse_mode: 'Markdown' });

            // Удаляем состояние
            setTimeout(() => {
                adminStateManager.delete(user.id);
            }, 5 * 60 * 1000);

        } else {
            await bot.sendMessage(
                chatId,
                '❌ Ошибка при регистрации администратора. Возможно, вы уже зарегистрированы.'
            );
            adminStateManager.delete(user.id);
        }
    }
}

// Команда для отмены регистрации администратора
export async function handleCancel(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        return;
    }

    // Удаляем состояние администратора
    if (adminStateManager.get(user.id)) {
        adminStateManager.delete(user.id);
        await bot.sendMessage(chatId, '❌ Регистрация администратора отменена.');
    }
}

// Экспортируем клавиатуру для администратора
export const adminPanelKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '🛴 Добавить СИМ' }, { text: '📋 Все СИМ' }],
            [{ text: '👥 Управление курьерами' }, { text: '📊 Статистика' }],
            [{ text: '📅 Управление сессиями' }, { text: '⚙️ Настройки' }],
            [{ text: '❓ Помощь' }, { text: '🏠 Главная' }]
        ],
        resize_keyboard: true
    }
};