import TelegramBot from 'node-telegram-bot-api';

export interface UserState {
    step: 'awaiting_name' | 'awaiting_phone' | 'registered';
    fullName?: string;
    phoneNumber?: string;
    telegramUser?: TelegramBot.User;
}

class UserStateManager {
    private userStates = new Map<number, UserState>();

    get(chatId: number): UserState | undefined {
        return this.userStates.get(chatId);
    }

    set(chatId: number, state: UserState): void {
        this.userStates.set(chatId, state);
    }

    delete(chatId: number): boolean {
        return this.userStates.delete(chatId);
    }

    clearExpiredStates(timeoutMinutes: number = 5): void {
        // Можно реализовать автоматическую очистку старых состояний
        // Временное решение - ручная очистка в обработчиках
    }
}

export const userStateManager = new UserStateManager();