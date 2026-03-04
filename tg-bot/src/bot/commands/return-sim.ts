// src/bot/commands/return-sim.ts

import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { SessionService, DamageType } from '../../services/session.service';
import { stateManager } from '../state-manager';
import { DeviceSessionState } from '../../constants/states.constant';
import { isCommand } from '../../constants/commands.constant';

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
    sessionService: SessionService
) {
    // Команда запуска процесса сдачи
    bot.onText(/\/return_sim/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

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
                await bot.sendMessage(chatId, '✅ Личный СИМ сдан, сессия завершена.');
            } else {
                await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
            }
            return;
        }

        // Начинаем диалог
        await bot.sendMessage(
            chatId,
            'Есть ли повреждение у СИМ?\n1. Нет\n2. Да'
        );
        stateManager.setUserState(telegramId, DeviceSessionState.RETURN_ASK_DAMAGE);
    });

    // последующие шаги — общий обработчик сообщений
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        const state = stateManager.getUserState(telegramId);
        if (!state) return;
        if (isCommand(msg.text || '')) return; // команды игнорируем

        const text = msg.text || '';

        switch (state) {
            case DeviceSessionState.RETURN_ASK_DAMAGE: {
                const yn = parseYesNo(text);
                if (yn === null) {
                    await bot.sendMessage(chatId, 'Пожалуйста, выберите 1 (Нет) или 2 (Да).');
                    return;
                }
                if (yn === 'no') {
                    // просто закрываем
                    const result = await sessionService.endSession(telegramId, { type: 'ok' });
                    if (result.success) {
                        await bot.sendMessage(chatId, '✅ Сессия завершена. Спасибо.');
                    } else {
                        await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
                    }
                    stateManager.clearUser(telegramId);
                    return;
                }
                // да — спрашиваем тип повреждения
                await bot.sendMessage(
                    chatId,
                    'Выберите тип повреждения:\n1. Слабое\n2. Критическое'
                );
                stateManager.setUserState(telegramId, DeviceSessionState.RETURN_DAMAGE_TYPE);
                return;
            }

            case DeviceSessionState.RETURN_DAMAGE_TYPE: {
                const dtype = parseDamageType(text);
                if (!dtype) {
                    await bot.sendMessage(chatId, 'Пожалуйста, выберите 1 или 2 (слабое/критическое).');
                    return;
                }
                // сохраняем выбранный тип
                stateManager.setUserTempDataField(telegramId, 'damageType', dtype);
                await bot.sendMessage(chatId, 'Опишите повреждения:');
                stateManager.setUserState(telegramId, DeviceSessionState.RETURN_DESCRIPTION);
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
