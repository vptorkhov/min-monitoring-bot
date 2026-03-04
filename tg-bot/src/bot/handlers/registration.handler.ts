// src/bot/handlers/registration.handler.ts

import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { RegistrationState } from '../../constants/states.constant';
import { isCommand } from '../../constants/commands.constant';
import { formatErrorMessage, formatSuccessMessage } from '../../utils/telegram.utils';
import { stateManager } from '../state-manager';

export class RegistrationHandler {
    constructor(
        private bot: TelegramBot,
        private courierService: CourierService
    ) { }

    /**
     * Начать процесс регистрации нового курьера
     * @param chatId - ID чата для отправки сообщений
     * @param userId - ID пользователя Telegram (ключ для хранения состояния)
     */
    async startRegistration(chatId: number, userId: number) {
        // Устанавливаем состояние "ожидание имени"
        stateManager.setUserState(userId, RegistrationState.AWAITING_NAME);

        await this.bot.sendMessage(
            chatId,
            '📝 Давайте зарегистрируем вас.\n\nПожалуйста, введите ваше полное имя:',
            { reply_markup: { force_reply: true } }
        );
    }

    /**
     * Основной обработчик входящих сообщений во время регистрации
     */
    async handleMessage(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        if (!msg.from) {
            return;
        }

        const userId = msg.from.id;
        const text = msg.text;

        if (!text) return;

        // Если это команда - игнорируем
        if (isCommand(text)) {
            console.log(`Команда ${text} от пользователя ${userId} проигнорирована registrationHandler`);
            return;
        }

        const currentState = stateManager.getUserState(userId);

        if (!currentState || currentState === RegistrationState.IDLE) {
            return;
        }

        switch (currentState) {
            case RegistrationState.AWAITING_NAME:
                await this.handleNameInput(chatId, userId, text);
                break;

            case RegistrationState.AWAITING_PHONE:
                // Передаём весь msg, чтобы получить username
                await this.handlePhoneInput(chatId, userId, text, msg);
                break;

            default:
                stateManager.clearUser(userId);
                await this.startRegistration(chatId, userId);
        }
    }

    /**
     * Обработка ввода полного имени
     */
    private async handleNameInput(chatId: number, userId: number, name: string) {
        const trimmedName = name.trim();

        if (trimmedName.length < 2) {
            await this.bot.sendMessage(
                chatId,
                formatErrorMessage('Имя должно содержать минимум 2 символа. Попробуйте снова:'),
                { reply_markup: { force_reply: true } }
            );
            return;
        }

        if (trimmedName.length > 100) {
            await this.bot.sendMessage(
                chatId,
                formatErrorMessage('Имя не может быть длиннее 100 символов. Пожалуйста, сократите:'),
                { reply_markup: { force_reply: true } }
            );
            return;
        }

        stateManager.setUserTempDataField(userId, 'fullName', trimmedName);
        stateManager.setUserState(userId, RegistrationState.AWAITING_PHONE);

        await this.bot.sendMessage(
            chatId,
            '📞 Теперь введите ваш номер телефона (например, +79001234567):\n\n',
            { reply_markup: { force_reply: true } }
        );
    }

    /**
     * Обработка ввода номера телефона
     */
    private async handlePhoneInput(chatId: number, userId: number, phone: string, msg: TelegramBot.Message) {
        const validation = this.courierService.validateAndPreparePhone(phone);

        if (!validation.isValid) {
            await this.bot.sendMessage(
                chatId,
                formatErrorMessage(validation.error || 'Некорректный формат номера. Попробуйте снова:'),
                { reply_markup: { force_reply: true } }
            );
            return;
        }

        const tempData = stateManager.getUserTempData<{ fullName?: string }>(userId);

        if (!tempData?.fullName) {
            stateManager.clearUser(userId);
            await this.startRegistration(chatId, userId);
            return;
        }

        // Получаем username из сообщения
        const username = msg.from?.username;

        const result = await this.courierService.registerCourier({
            fullName: tempData.fullName,
            phoneNumber: validation.cleaned!,
            telegramId: userId,
            nickname: username // передаём username (может быть undefined)
        });

        if (result.success) {
            stateManager.clearUser(userId);

            await this.bot.sendMessage(
                chatId,
                formatSuccessMessage(
                    '🎉 Регистрация успешно завершена!\n\n' +
                    'Ваша заявка отправлена на рассмотрение администратору. ' +
                    'Как только ваш аккаунт будет активирован, вы получите уведомление.'
                )
            );
        } else {
            await this.bot.sendMessage(
                chatId,
                formatErrorMessage(result.error || 'Ошибка при регистрации. Пожалуйста, попробуйте позже.')
            );
        }
    }

    /**
     * Отмена регистрации
     */
    async cancelRegistration(_chatId: number, userId: number) {
        stateManager.clearUser(userId);
    }

    /**
     * Проверка, находится ли пользователь в процессе регистрации
     */
    // Признак того, что пользователь находится именно
    // в процессе **регистрации** (имена/телефон). Мы не должны
    // возвращать true для других состояний (склад, аренда и т.п.).
    isUserInRegistration(userId: number): boolean {
        const state = stateManager.getUserState(userId);
        return (
            state === RegistrationState.AWAITING_NAME ||
            state === RegistrationState.AWAITING_PHONE
        );
    }
}