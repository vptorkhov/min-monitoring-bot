// src/bot/commands/return-sim.ts

import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { SessionService, DamageType } from '../../services/session.service';
import { CallbackQueryHandler } from '../callback-router';
import { stateManager } from '../state-manager';
import { DeviceSessionState } from '../../constants/states.constant';
import { isCommand } from '../../constants/commands.constant';
import {
    getCourierIdleKeyboard,
    getReturnSimDamageQuestionKeyboard,
    getReturnSimDamageQuestionInlineKeyboard,
    getReturnSimDamageTypeInlineKeyboard,
    getReturnSimDamageTypeKeyboard
} from '../keyboards';
import { convertKeyboardButtonToCommand } from '../../utils/telegram.utils';
import { sendCourierMainKeyboard } from '../keyboards/courier-main-keyboard';
import { INLINE_CALLBACK_DATA } from '../keyboards';
import { blockIfAdminGuestCommandNotAllowed } from '../admin/admin-mode';

const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
    remove_keyboard: true
};

// вспомогательные функции
function normalizeAnswer(answer: string): string {
    return answer.trim().toLowerCase();
}

/**
 * Проверка на "да"/"нет". Возвращает 'yes', 'no' или null.
 */
function parseYesNo(answer: string): 'yes' | 'no' | null {
    const norm = normalizeAnswer(answer);
    if (/^\s*1\s*$/.test(answer) || norm === 'нет' || norm === 'no') return 'no';
    if (/^\s*2\s*$/.test(answer) || norm === 'да' || norm === 'yes') return 'yes';
    return null;
}

/**
 * Парсит выбор типа повреждения: 1 - слабое, 2 - критическое
 */
function parseDamageType(answer: string): DamageType | null {
    const norm = normalizeAnswer(answer);
    if (/^\s*1\s*$/.test(answer) || norm === 'слабое' || norm === 'weak') return 'warning';
    if (/^\s*2\s*$/.test(answer) || norm === 'критическое' || norm === 'critical') return 'broken';
    return null;
}

export function registerReturnSimCommand(
    bot: TelegramBot,
    courierService: CourierService,
    sessionService: SessionService,
    registerCallbackHandler: (handler: CallbackQueryHandler) => void
) {
    const sendIdleKeyboardIfEligible = async (chatId: number, telegramId: number) => {
        const check = await courierService.checkCourierExists(telegramId);
        if (!check.exists || !check.isActive || !check.courier?.warehouse_id) {
            return;
        }

        const hasSession = await sessionService.hasActiveSession(telegramId);
        if (hasSession) {
            return;
        }

        await bot.sendMessage(chatId, 'Выберите действие:', {
            reply_markup: getCourierIdleKeyboard()
        });
    };

    const handleReturnAskDamageDecision = async (
        chatId: number,
        telegramId: number,
        yn: 'yes' | 'no'
    ) => {
        if (yn === 'no') {
            const result = await sessionService.endSession(telegramId, { type: 'ok' });
            if (result.success) {
                await bot.sendMessage(chatId, '✅ Сессия завершена. Спасибо.');
                await sendIdleKeyboardIfEligible(chatId, telegramId);
            } else {
                await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
            }
            stateManager.clearUser(telegramId);
            return;
        }

        await bot.sendMessage(
            chatId,
            'Выберите тип повреждения:\n1. Слабое\n2. Критическое',
            { reply_markup: getReturnSimDamageTypeInlineKeyboard() }
        );

        await bot.sendMessage(chatId, 'Или используйте reply-клавиатуру ниже:', {
            reply_markup: getReturnSimDamageTypeKeyboard()
        });

        stateManager.setUserState(telegramId, DeviceSessionState.RETURN_DAMAGE_TYPE);
    };

    const handleReturnDamageTypeDecision = async (
        chatId: number,
        telegramId: number,
        dtype: DamageType
    ) => {
        stateManager.setUserTempDataField(telegramId, 'damageType', dtype);
        await bot.sendMessage(chatId, 'Опишите повреждения:', {
            reply_markup: HIDE_REPLY_KEYBOARD
        });
        stateManager.setUserState(telegramId, DeviceSessionState.RETURN_DESCRIPTION);
    };

    const startReturnSimFlow = async (chatId: number, telegramId: number) => {
        const check = await courierService.checkCourierExists(telegramId);
        if (!check.exists) {
            await bot.sendMessage(chatId, '❌ Вы не зарегистрированы.');
            return;
        }
        if (!check.isActive) {
            await bot.sendMessage(chatId, '❌ Ваш аккаунт еще не активирован.');
            return;
        }

        const activeSession = await sessionService.hasActiveSession(telegramId);
        if (!activeSession) {
            await bot.sendMessage(chatId, '❌ У вас нет активной сессии.');
            return;
        }

        // Если устройство личное — сразу завершаем сессию
        const personal = await sessionService.isActiveSessionPersonal(telegramId);
        if (personal) {
            const result = await sessionService.endSession(telegramId, { type: 'ok' });
            if (result.success) {
                await bot.sendMessage(chatId, '✅ Личный СИМ сдан, сессия завершена.', {
                    reply_markup: HIDE_REPLY_KEYBOARD
                });
                await sendIdleKeyboardIfEligible(chatId, telegramId);
            } else {
                await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
            }
            return;
        }

        // Начинаем диалог
        await bot.sendMessage(
            chatId,
            'Есть ли повреждение у СИМ?\n1. Нет\n2. Да',
            { reply_markup: getReturnSimDamageQuestionInlineKeyboard() }
        );

        await bot.sendMessage(chatId, 'Или используйте reply-клавиатуру ниже:', {
            reply_markup: getReturnSimDamageQuestionKeyboard()
        });

        stateManager.setUserState(telegramId, DeviceSessionState.RETURN_ASK_DAMAGE);
    };

    // Команда запуска процесса сдачи
    bot.onText(/^\/return_sim(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        if (await blockIfAdminGuestCommandNotAllowed(bot, chatId, telegramId, msg.text)) {
            return;
        }

        await startReturnSimFlow(chatId, telegramId);
    });

    registerCallbackHandler(async (query) => {
        const callbackData = query.data;
        if (
            callbackData !== INLINE_CALLBACK_DATA.RETURN_DAMAGE_NO &&
            callbackData !== INLINE_CALLBACK_DATA.RETURN_DAMAGE_YES &&
            callbackData !== INLINE_CALLBACK_DATA.RETURN_DAMAGE_WEAK &&
            callbackData !== INLINE_CALLBACK_DATA.RETURN_DAMAGE_CRITICAL
        ) {
            return false;
        }

        const chatId = query.message?.chat.id;
        const telegramId = query.from.id;
        if (!chatId) {
            return false;
        }

        if (
            callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_NO ||
            callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_YES ||
            callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_WEAK ||
            callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_CRITICAL
        ) {
            if (await blockIfAdminGuestCommandNotAllowed(bot, chatId, telegramId, '/return_sim')) {
                return true;
            }
        }

        const state = stateManager.getUserState(telegramId);

        if (
            callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_NO ||
            callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_YES
        ) {
            if (state !== DeviceSessionState.RETURN_ASK_DAMAGE) {
                await bot.sendMessage(chatId, 'ℹ️ Сначала запустите сдачу СИМ командой /return_sim.');
                return true;
            }

            const answerText = callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_NO ? 'Нет' : 'Да';
            await bot.sendMessage(chatId, answerText);

            const yn: 'yes' | 'no' = callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_NO ? 'no' : 'yes';
            await handleReturnAskDamageDecision(chatId, telegramId, yn);
            return true;
        }

        if (state !== DeviceSessionState.RETURN_DAMAGE_TYPE) {
            await bot.sendMessage(chatId, 'ℹ️ Сначала выберите, есть ли повреждение у СИМ.');
            return true;
        }

        const damageTypeText = callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_WEAK ? 'Слабое' : 'Критическое';
        await bot.sendMessage(chatId, damageTypeText);

        const dtype: DamageType = callbackData === INLINE_CALLBACK_DATA.RETURN_DAMAGE_WEAK ? 'warning' : 'broken';
        await handleReturnDamageTypeDecision(chatId, telegramId, dtype);
        return true;
    });

    // последующие шаги — общий обработчик сообщений
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        const textAsCommand = convertKeyboardButtonToCommand(msg.text || '');
        if (textAsCommand === '/return_sim' && (msg.text || '') !== '/return_sim') {
            if (await blockIfAdminGuestCommandNotAllowed(bot, chatId, telegramId, msg.text)) {
                return;
            }

            await startReturnSimFlow(chatId, telegramId);
            return;
        }

        const state = stateManager.getUserState(telegramId);
        if (!state) return;

        if (textAsCommand === '/cancel' && (msg.text || '') !== '/cancel') {
            stateManager.clearUser(telegramId);
            await bot.sendMessage(chatId, '❌ Действие отменено.', {
                reply_markup: HIDE_REPLY_KEYBOARD
            });
            await sendCourierMainKeyboard(bot, chatId, telegramId, courierService, sessionService);
            return;
        }

        if (isCommand(msg.text || '')) return; // команды игнорируем

        const text = msg.text || '';

        switch (state) {
            case DeviceSessionState.RETURN_ASK_DAMAGE: {
                const yn = parseYesNo(text);
                if (yn === null) {
                    await bot.sendMessage(chatId, 'Пожалуйста, выберите 1 (Нет) или 2 (Да).');
                    return;
                }
                await handleReturnAskDamageDecision(chatId, telegramId, yn);
                return;
            }

            case DeviceSessionState.RETURN_DAMAGE_TYPE: {
                const dtype = parseDamageType(text);
                if (!dtype) {
                    await bot.sendMessage(chatId, 'Пожалуйста, выберите 1 или 2 (слабое/критическое).');
                    return;
                }
                await handleReturnDamageTypeDecision(chatId, telegramId, dtype);
                return;
            }

            case DeviceSessionState.RETURN_DESCRIPTION: {
                const dtype = stateManager.getUserTempData<{ damageType?: DamageType }>(telegramId)?.damageType;
                const comment = text.trim();
                if (!dtype) {
                    // логическая ошибка; сбросим состояние
                    stateManager.clearUser(telegramId);
                    return;
                }
                const result = await sessionService.endSession(telegramId, {
                    type: dtype,
                    comment
                });
                if (result.success) {
                    await bot.sendMessage(chatId, '✅ Сессия завершена, спасибо за информацию.');
                    await sendIdleKeyboardIfEligible(chatId, telegramId);
                } else {
                    await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
                }
                stateManager.clearUser(telegramId);
                return;
            }

            default:
                // не нашёлся соответствующий state
                return;
        }
    });
}
