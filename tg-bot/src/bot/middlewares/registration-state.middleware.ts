// src/bot/middlewares/registration-state.middleware.ts

import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { isCommand } from '../../constants/commands.constant';

/**
 * Middleware для проверки состояния регистрации пользователя.
 * 
 * Задачи:
 * 1. Проверяет, находится ли пользователь в процессе регистрации
 * 2. Если да И сообщение НЕ является командой - перенаправляет в registrationHandler
 * 3. Если да И сообщение является командой - пропускает к командам (команды имеют приоритет)
 * 4. Если нет - пропускает сообщение дальше к обработчикам команд
 */
export function createRegistrationStateMiddleware(
    registrationHandler: RegistrationHandler
) {
    /**
     * Простая функция-обработчик для bot.on('message').
     * Она проверяет, находится ли пользователь в регистрации и
     * если да — перенаправляет текст в registrationHandler.
     * В случае команды или когда пользователь не в процессе,
     * ничего не делает и позволяет другим слушателям сработать.
     */
    return async function registrationStateMiddleware(
        msg: TelegramBot.Message
    ) {
        // Если нет from (служебные сообщения) - ничего не делаем
        if (!msg.from) {
            return;
        }

        const userId = msg.from.id;
        const text = msg.text;

        // Проверяем, находится ли пользователь в процессе регистрации
        const isInRegistration = registrationHandler.isUserInRegistration(userId);

        // Если пользователь не регистрируется - выходим
        if (!isInRegistration) {
            return;
        }

        // Пользователь в процессе регистрации
        // Если это команда — позволяем обработчикам команд выполнить свою логику
        if (text && isCommand(text)) {
            console.log(`Команда ${text} от пользователя ${userId} пропущена к обработчикам (приоритет над регистрацией)`);
            return;
        }

        // Не команда и пользователь регистрируется - обрабатываем в registrationHandler
        await registrationHandler.handleMessage(msg);
    };
}

/**
 * Вспомогательная функция для регистрации middleware в боте
 * 
 * @param bot - экземпляр Telegram бота
 * @param registrationHandler - обработчик регистрации
 */
export function setupRegistrationMiddleware(
    bot: TelegramBot,
    registrationHandler: RegistrationHandler
) {
    // Создаем middleware функцию
    const middleware = createRegistrationStateMiddleware(registrationHandler);

    // Регистрируем её на все сообщения
    bot.on('message', middleware);

    console.log('✅ Middleware регистрации настроен');
}