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
     * Возвращает функцию-обработчик для использования с bot.on('message')
     * 
     * @param msg - входящее сообщение от Telegram
     * @param next - функция для передачи управления дальше
     */
    return async function registrationStateMiddleware(
        msg: TelegramBot.Message,
        next: (msg: TelegramBot.Message) => void
    ) {
        // Если нет from (служебные сообщения) - пропускаем
        if (!msg.from) {
            next(msg);
            return;
        }

        const userId = msg.from.id;
        const text = msg.text;

        // Проверяем, находится ли пользователь в процессе регистрации
        const isInRegistration = registrationHandler.isUserInRegistration(userId);

        // Если пользователь не регистрируется - пропускаем сообщение дальше
        if (!isInRegistration) {
            next(msg);
            return;
        }

        // Пользователь в процессе регистрации
        // Проверяем, является ли сообщение командой
        if (text && isCommand(text)) {
            // Команда имеет приоритет - пропускаем к обработчикам команд
            console.log(`Команда ${text} от пользователя ${userId} пропущена к обработчикам (приоритет над регистрацией)`);
            next(msg);
            return;
        }

        // Не команда и пользователь регистрируется - обрабатываем в registrationHandler
        await registrationHandler.handleMessage(msg);
        // НЕ вызываем next() - сообщение обработано
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
    // Создаем middleware
    const middleware = createRegistrationStateMiddleware(registrationHandler);

    // Регистрируем middleware на все сообщения
    bot.on('message', async (msg) => {
        // Создаем next функцию, которая будет вызвана, если пользователь не регистрируется
        // или если сообщение является командой
        const next = (message: TelegramBot.Message) => {
            console.log(`Сообщение от пользователя ${message.from?.id} пропущено к командам`);
        };

        await middleware(msg, next);
    });

    console.log('✅ Middleware регистрации настроен');
}