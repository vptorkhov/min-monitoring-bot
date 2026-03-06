// src/bot/commands/start.ts

import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import {
    getCourierActiveSessionKeyboard,
    getCourierIdleKeyboard,
    getSelectWarehouseKeyboard
} from '../keyboards/registration.keyboard';

export function registerStartCommand(
    bot: TelegramBot,
    courierService: CourierService,
    registrationHandler: RegistrationHandler,
    sessionService: SessionService
) {
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;

        // Проверяем, что from существует
        if (!msg.from) {
            await bot.sendMessage(chatId, '❌ Ошибка идентификации пользователя');
            return;
        }

        const userId = msg.from.id;

        try {
            // Проверяем, зарегистрирован ли курьер
            const checkResult = await courierService.checkCourierExists(userId);

            if (!checkResult.exists) {
                // Курьер не найден - запускаем регистрацию
                await registrationHandler.startRegistration(chatId, userId);
                return;
            }

            // Проверяем, что курьер действительно существует (для TypeScript)
            if (!checkResult.courier) {
                console.error(`Противоречивые данные: exists=true, но courier=null для userId ${userId}`);
                await bot.sendMessage(
                    chatId,
                    '❌ Ошибка при загрузке данных профиля. Пожалуйста, обратитесь к администратору.'
                );
                return;
            }

            // Теперь TypeScript знает, что courier существует
            const courier = checkResult.courier;

            // Проверяем статус активности
            if (!checkResult.isActive) {
                // Курьер не активирован
                await bot.sendMessage(
                    chatId,
                    '⏳ Ваша заявка на регистрацию ещё рассматривается администратором.\n' +
                    'Как только ваш аккаунт будет активирован, вы получите уведомление.'
                );
                return;
            }

            // Курьер активен - приветствуем и показываем релевантную клавиатуру.
            const greeting = `👋 С возвращением, ${courier.full_name}!\n\nДобро пожаловать в Мониторинг СИМ.`;
            const hasActiveSession = await sessionService.hasActiveSession(userId);

            if (hasActiveSession) {
                await bot.sendMessage(chatId, `${greeting}\n\nУ вас активная сессия. Используйте кнопку ниже для сдачи СИМ:`, {
                    reply_markup: getCourierActiveSessionKeyboard()
                });
                return;
            }

            if (!courier.warehouse_id) {
                await bot.sendMessage(chatId, `${greeting}\n\nПожалуйста, выберите склад:`, {
                    reply_markup: getSelectWarehouseKeyboard()
                });
                return;
            }

            await bot.sendMessage(chatId, `${greeting}\n\nВыберите действие:`, {
                reply_markup: getCourierIdleKeyboard()
            });

        } catch (error) {
            console.error('Ошибка в обработчике /start:', error);
            await bot.sendMessage(
                chatId,
                '❌ Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь к администратору.'
            );
        }
    });
}