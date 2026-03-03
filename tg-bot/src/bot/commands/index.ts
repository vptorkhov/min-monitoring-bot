// src/bot/commands/index.ts

import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { RegistrationHandler } from '../handlers/registration.handler';
import { registerStartCommand } from './start';
import { BOT_COMMANDS } from '../../constants/commands.constant';

/**
 * Регистрация всех команд бота
 * @param bot - экземпляр Telegram бота
 * @param courierService - сервис курьеров
 * @param registrationHandler - обработчик регистрации
 */
export function registerAllCommands(
    bot: TelegramBot,
    courierService: CourierService,
    registrationHandler: RegistrationHandler
) {
    console.log('📝 Регистрация команд бота...');

    // Регистрируем только существующие команды
    registerStartCommand(bot, courierService, registrationHandler);
    // TODO: добавить registerCancelCommand когда будет создан
    // TODO: добавить registerHelpCommand когда будет создан

    // Устанавливаем список команд для отображения в меню Telegram
    // Включаем только реально существующие команды
    bot.setMyCommands([
        { command: 'start', description: '🚀 Начать работу с ботом' }
        // TODO: добавить /cancel когда будет реализован
        // TODO: добавить /help когда будет реализован
    ]).then(() => {
        console.log('✅ Меню команд обновлено');
    }).catch((error) => {
        console.error('❌ Ошибка при обновлении меню команд:', error);
    });

    console.log('✅ Команды бота зарегистрированы');

    // Возвращаем список зарегистрированных команд
    return BOT_COMMANDS;
}