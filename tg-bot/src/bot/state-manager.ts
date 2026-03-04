/**
 * Централизованный менеджер состояний пользователей Telegram
 * 
 * Заменяет собой:
 * - registrationStates и registrationTempData из registration.handler.ts
 * - userStates и userTempData из user-state.ts
 * 
 * Единая точка управления всеми состояниями и временными данными.
 */

interface UserStateData {
    state?: string;
    tempData?: Record<string, any>;
}

class StateManager {
    // Единое хранилище состояний и данных для всех пользователей
    private states: Map<number, UserStateData> = new Map();

    /**
     * Получить текущее состояние пользователя
     * @param telegramId ID пользователя Telegram
     * @returns Строка состояния или undefined
     */
    getUserState(telegramId: number): string | undefined {
        return this.states.get(telegramId)?.state;
    }

    /**
     * Установить состояние пользователя
     * @param telegramId ID пользователя Telegram
     * @param state Значение состояния
     */
    setUserState(telegramId: number, state: string): void {
        const existing = this.states.get(telegramId) || {};
        this.states.set(telegramId, { ...existing, state });
    }

    /**
     * Сбросить состояние пользователя
     * @param telegramId ID пользователя Telegram
     */
    resetUserState(telegramId: number): void {
        const existing = this.states.get(telegramId);
        if (existing) {
            const { tempData } = existing;
            if (tempData && Object.keys(tempData).length > 0) {
                // Если есть временные данные, оставляем их, сбрасываем только состояние
                this.states.set(telegramId, { tempData });
            } else {
                // Если нет временных данных, удаляем пользователя полностью
                this.states.delete(telegramId);
            }
        }
    }

    /**
     * Получить временные данные пользователя (типизированно)
     * @param telegramId ID пользователя Telegram
     * @returns Объект с временными данными или undefined
     */
    getUserTempData<T extends Record<string, any> = Record<string, any>>(telegramId: number): T | undefined {
        return this.states.get(telegramId)?.tempData as T | undefined;
    }

    /**
     * Установить временные данные пользователя
     * @param telegramId ID пользователя Telegram
     * @param data Объект с данными для сохранения
     */
    setUserTempData(telegramId: number, data: Record<string, any>): void {
        const existing = this.states.get(telegramId) || {};
        this.states.set(telegramId, {
            ...existing,
            tempData: { ...existing.tempData, ...data }
        });
    }

    /**
     * Обновить конкретное поле во временных данных
     * @param telegramId ID пользователя Telegram
     * @param key Ключ поля
     * @param value Значение поля
     */
    setUserTempDataField(telegramId: number, key: string, value: any): void {
        const existing = this.states.get(telegramId) || {};
        this.states.set(telegramId, {
            ...existing,
            tempData: { ...existing.tempData, [key]: value }
        });
    }

    /**
     * Сбросить временные данные пользователя
     * @param telegramId ID пользователя Telegram
     */
    resetUserTempData(telegramId: number): void {
        const existing = this.states.get(telegramId);
        if (existing) {
            const { state } = existing;
            if (state) {
                // Если есть состояние, оставляем его, сбрасываем только данные
                this.states.set(telegramId, { state });
            } else {
                // Если нет состояния, удаляем пользователя полностью
                this.states.delete(telegramId);
            }
        }
    }

    /**
     * Полностью очистить данные пользователя
     * @param telegramId ID пользователя Telegram
     */
    clearUser(telegramId: number): void {
        this.states.delete(telegramId);
    }

    /**
     * Проверить, есть ли у пользователя активное состояние
     * @param telegramId ID пользователя Telegram
     * @returns true если у пользователя установлено состояние
     */
    hasState(telegramId: number): boolean {
        return !!this.states.get(telegramId)?.state;
    }

    /**
     * Получить статистику (для отладки)
     * @returns Количество пользователей с состояниями
     */
    getStats(): { activeUsers: number } {
        return {
            activeUsers: this.states.size
        };
    }
}

// Синглтон экземпляр менеджера состояний
const stateManager = new StateManager();

export { StateManager, stateManager };
