import TelegramBot from 'node-telegram-bot-api';
import { dbClient } from '../../config/database';
import { userStateManager } from '../../utils/userState';
import { Keyboards } from '../keyboards';

// Регистрируем нового курьера
export async function registerCourier(
    chatId: number,
    fullName: string,
    phoneNumber: string,
    telegramUser: TelegramBot.User
): Promise<boolean> {
    try {
        // Получаем nickname из Telegram
        let nickname: string | null = null;

        // Пробуем получить username из Telegram
        if (telegramUser.username) {
            nickname = telegramUser.username;
        } else if (telegramUser.first_name) {
            // Если нет username, используем first_name + id
            nickname = `${telegramUser.first_name}_${chatId}`.toLowerCase().replace(/\s+/g, '_');
        } else {
            // Если совсем нет данных, используем chatId
            nickname = `user_${chatId}`;
        }

        // Ограничиваем длину nickname (PostgreSQL может иметь ограничения)
        if (nickname.length > 50) {
            nickname = nickname.substring(0, 50);
        }

        // Проверяем, существует ли уже такой nickname
        let finalNickname = nickname;
        let counter = 1;

        while (true) {
            try {
                const checkResult = await dbClient.query(
                    'SELECT id FROM couriers WHERE nickname = $1',
                    [finalNickname]
                );

                if (checkResult.rows.length === 0) {
                    break; // Nickname свободен
                }

                // Если занят, добавляем цифру
                finalNickname = `${nickname}_${counter}`;
                counter++;

                // Защита от бесконечного цикла
                if (counter > 10) {
                    finalNickname = `${nickname}_${Date.now()}`;
                    break;
                }
            } catch (error) {
                console.error('❌ Ошибка проверки nickname:', error);
                break;
            }
        }

        // Добавляем курьера в базу данных (только необходимые поля)
        const result = await dbClient.query(
            `INSERT INTO couriers (
                full_name, 
                nickname, 
                phone_number, 
                is_active
            ) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id`,
            [
                fullName,
                finalNickname,
                phoneNumber,
                true
            ]
        );

        console.log(`✅ Зарегистрирован новый курьер: ${fullName} (ID: ${result.rows[0].id}, Nickname: ${finalNickname})`);

        // Логируем информацию о Telegram пользователе
        console.log(`📱 Telegram данные: 
            Username: ${telegramUser.username || 'не указан'}
            ID: ${telegramUser.id}
            Имя: ${telegramUser.first_name || 'не указано'}
            Фамилия: ${telegramUser.last_name || 'не указана'}
            Язык: ${telegramUser.language_code || 'не указан'}`);

        return true;
    } catch (error: any) {
        console.error('❌ Ошибка регистрации курьера:', error);

        // Более детальный вывод ошибки
        if (error.code === '23505') { // Unique violation
            console.error('⛔ Нарушение уникальности:', error.constraint);
            if (error.constraint === 'couriers_nickname_key') {
                console.error('⚠️ Такой nickname уже существует');
            } else if (error.constraint === 'couriers_phone_number_key') {
                console.error('⚠️ Такой номер телефона уже зарегистрирован');
            }
        }

        return false;
    }
}

// Проверяем, зарегистрирован ли пользователь в базе данных
export async function checkUserRegistration(telegramUser: TelegramBot.User): Promise<boolean> {
    try {
        // Сначала пытаемся найти по username (если он есть)
        if (telegramUser.username) {
            const result = await dbClient.query(
                'SELECT id FROM couriers WHERE nickname = $1',
                [telegramUser.username]
            );

            if (result.rows.length > 0) {
                return true;
            }
        }

        // Если нет username или не нашли по username, ищем по имени и ID
        if (telegramUser.first_name) {
            const searchNickname = `${telegramUser.first_name}_${telegramUser.id}`.toLowerCase().replace(/\s+/g, '_');
            const result = await dbClient.query(
                'SELECT id FROM couriers WHERE nickname LIKE $1',
                [`${telegramUser.first_name.toLowerCase()}_%`]
            );

            if (result.rows.length > 0) {
                return true;
            }
        }

        // Ищем по chatId как запасной вариант
        const fallbackNickname = `user_${telegramUser.id}`;
        const result = await dbClient.query(
            'SELECT id FROM couriers WHERE nickname = $1',
            [fallbackNickname]
        );

        return result.rows.length > 0;
    } catch (error) {
        console.error('❌ Ошибка проверки регистрации пользователя:', error);
        return false;
    }
}

// Обработчик текстовых сообщений для регистрации
export async function handleRegistrationMessage(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const user = msg.from;

    // Пропускаем команды, начинающиеся с /
    if (text.startsWith('/')) {
        return;
    }

    // Получаем текущее состояние пользователя
    const userState = userStateManager.get(chatId);

    if (!userState || !user) {
        // Если нет состояния или информации о пользователе, игнорируем
        return;
    }

    // Обработка в зависимости от шага регистрации
    if (userState.step === 'awaiting_name') {
        // Пользователь ввел ФИО
        if (text.trim().split(' ').length < 2) {
            // Проверяем, что введено полное ФИО
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите полное ФИО (например: Иванов Иван Иванович).\n' +
                'Должно быть минимум 2 слова:',
                Keyboards.helpOnly
            );
            return;
        }

        // Сохраняем ФИО
        userState.fullName = text.trim();
        userState.step = 'awaiting_phone';
        userState.telegramUser = user;

        await bot.sendMessage(
            chatId,
            `✅ ФИО сохранено: *${userState.fullName}*\n\n` +
            `Теперь введите ваш *номер телефона* (например: +79991234567):`,
            {
                parse_mode: 'Markdown',
                ...Keyboards.helpOnly
            }
        );

    } else if (userState.step === 'awaiting_phone') {
        // Пользователь ввел номер телефона
        const phoneNumber = text.trim();

        // Простая валидация номера телефона
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        if (!phoneRegex.test(phoneNumber)) {
            await bot.sendMessage(
                chatId,
                '⚠️ Пожалуйста, введите корректный номер телефона.\n' +
                'Пример: +79991234567 или 89991234567',
                Keyboards.helpOnly
            );
            return;
        }

        // Форматируем номер телефона
        let formattedPhone = phoneNumber;
        if (!phoneNumber.startsWith('+')) {
            // Если номер начинается с 8, заменяем на +7
            if (phoneNumber.startsWith('8')) {
                formattedPhone = '+7' + phoneNumber.substring(1);
            } else if (phoneNumber.startsWith('7')) {
                formattedPhone = '+' + phoneNumber;
            } else {
                formattedPhone = '+7' + phoneNumber;
            }
        }

        // Сохраняем номер телефона
        userState.phoneNumber = formattedPhone;

        // Регистрируем курьера в базе данных
        if (userState.fullName && userState.telegramUser) {
            const registrationSuccess = await registerCourier(
                chatId,
                userState.fullName,
                userState.phoneNumber,
                userState.telegramUser
            );

            if (registrationSuccess) {
                userState.step = 'registered';

                // Отправляем успешное сообщение
                const telegramUsername = userState.telegramUser.username
                    ? `@${userState.telegramUser.username}`
                    : 'не указан';

                const successText = `🎉 *Регистрация успешно завершена!*\n\n` +
                    `*ФИО:* ${userState.fullName}\n` +
                    `*Телефон:* ${userState.phoneNumber}\n` +
                    `*Telegram:* ${telegramUsername}\n\n` +
                    `Теперь вы можете:\n` +
                    `• Просматривать средства (/devices)\n` +
                    `• Начинать сессии (/startsession)\n` +
                    `• Смотреть доступные средства (/available)\n\n` +
                    `Используйте /help для списка всех команд.`;

                await bot.sendMessage(chatId, successText, {
                    parse_mode: 'Markdown',
                    ...Keyboards.courierKeyboard
                });

                // Удаляем состояние через 5 минут
                setTimeout(() => {
                    userStateManager.delete(chatId);
                }, 5 * 60 * 1000);

            } else {
                await bot.sendMessage(
                    chatId,
                    '❌ Ошибка при регистрации. Возможно, такой номер телефона или username уже зарегистрирован.\n' +
                    'Пожалуйста, попробуйте снова через /start',
                    Keyboards.start
                );
                userStateManager.delete(chatId);
            }
        }
    }
}