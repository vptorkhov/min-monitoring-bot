import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from './courier.service';

/**
 * Фоновый воркер, который отслеживает появление новых активированных
 * курьеров и мгновенно шлёт им уведомления.
 *
 * Хранит в памяти Set telegramId, чтобы не слать повторно. Это означает,
 * что после перезапуска бота часть уведомлений может быть отправлена
 * повторно или пропущена; в scope текущего проекта это приемлемо.
 */
export class ActivationNotifier {
    private notified = new Set<number>();
    private intervalId: NodeJS.Timeout | null = null;

    constructor(
        private bot: TelegramBot,
        private courierService: CourierService,
        private pollIntervalMs = 30_000 // по умолчанию каждые 30 секунд
    ) {}

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
        const couriers = await this.courierService.getActiveCouriers();
        for (const c of couriers) {
            if (!this.notified.has(c.telegram_id)) {
                try {
                    await this.bot.sendMessage(
                        c.telegram_id,
                        '✅ Ваша учетная запись активирована! Добро пожаловать.'
                    );
                    this.notified.add(c.telegram_id);
                } catch (err) {
                    console.error('Failed to notify courier', c.telegram_id, err);
                }
            }
        }
    }
}
