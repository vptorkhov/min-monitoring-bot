// В новом файле src/utils/stateManager.ts
import TelegramBot from 'node-telegram-bot-api';

type UserStateType = 'admin_registration' | 'device_addition' | 'courier_registration' | 'none';

interface UserState {
    type: UserStateType;
    data: any;
    timestamp: number;
}

class StateManager {
    private states = new Map<number, UserState>();

    getState(telegramId: number): UserState | undefined {
        return this.states.get(telegramId);
    }

    setState(telegramId: number, type: UserStateType, data?: any): void {
        this.states.set(telegramId, {
            type,
            data: data || {},
            timestamp: Date.now()
        });
    }

    clearState(telegramId: number): boolean {
        return this.states.delete(telegramId);
    }

    getStateType(telegramId: number): UserStateType {
        return this.states.get(telegramId)?.type || 'none';
    }

    clearExpiredStates(timeoutMinutes: number = 10): void {
        const now = Date.now();
        const timeout = timeoutMinutes * 60 * 1000;

        for (const [telegramId, state] of this.states.entries()) {
            if (now - state.timestamp > timeout) {
                this.states.delete(telegramId);
            }
        }
    }
}

export const stateManager = new StateManager();