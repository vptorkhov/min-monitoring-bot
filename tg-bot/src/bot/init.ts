// src/bot/init.ts

import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../services/courier.service';
import { RegistrationHandler } from './handlers/registration.handler';
import { setupAllMiddlewares } from './middlewares';
import { registerAllCommands } from './commands';

export function initBot(bot: TelegramBot) {
    // Создание сервисов (конструктор без параметров)
    const courierService = new CourierService();

    // Создание обработчиков
    const registrationHandler = new RegistrationHandler(bot, courierService);

    // Настройка middleware
    setupAllMiddlewares(bot, registrationHandler);

    // Регистрация команд с передачей зависимостей
    registerAllCommands(bot, courierService, registrationHandler);

    return { courierService, registrationHandler };
}