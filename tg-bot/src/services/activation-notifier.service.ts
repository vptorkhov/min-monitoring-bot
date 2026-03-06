import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from './courier.service';
import {
    getSelectWarehouseKeyboard,
    KEYBOARD_BUTTON_TEXT
} from '../bot/keyboards/registration.keyboard';

/**
 * Фоновый воркер, который отслеживает появление новых активированных
 * курьеров и мгновенно шлёт им уведомления.
 *
 * Использует поле notified_at в БД для отслеживания отправленных уведомлений,
 * что позволяет корректно работать после перезапуска бота.
 */
export class ActivationNotifier {
    private intervalId: NodeJS.Timeout | null = null;

    constructor(
        private bot: TelegramBot,
        private courierService: CourierService,
        private pollIntervalMs = 30_000 // по умолчанию каждые 30 секунд
    ) { }

    start() {
        if (this.intervalId) return; // уже запущен
        this.intervalId = setInterval(() => {
            this.checkAndNotify().catch(err => {
                console.error('ActivationNotifier error:', err);
            });
        }, this.pollIntervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async checkAndNotify() {
        const couriers = await this.courierService.getActiveNotNotifiedCouriers();
        for (const c of couriers) {
            try {
                // Отправляем сообщение об активации с inline-кнопкой
                await this.bot.sendMessage(
                    c.telegram_id,
                    '✅ Ваша учетная запись активирована! Добро пожаловать.',
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: KEYBOARD_BUTTON_TEXT.SELECT_WAREHOUSE,
                                        callback_data: 'set_warehouse'
                                    }
                                ]
                            ]
                        }
                    }
                );

                // Отправляем reply-клавиатуру с кнопкой выбора склада
                await this.bot.sendMessage(
                    c.telegram_id,
                    'Пожалуйста, выберите склад:',
                    { reply_markup: getSelectWarehouseKeyboard() }
                );

                // Отмечаем пользователя как уведомленного
                await this.courierService.markNotified(c.id);
            } catch (err) {
                console.error('Failed to notify courier', c.telegram_id, err);
            }
        }
    }
}
