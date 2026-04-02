// Тексты кнопок reply/inline-клавиатур
export const KEYBOARD_BUTTON_TEXT = {
    START: '✔️ Старт',
    CANCEL: '❌ Отмена',
    NO: 'Нет',
    YES: 'Да',
    WEAK: 'Слабое',
    CRITICAL: 'Критическое',
    SELECT_WAREHOUSE: '🏠 Выбрать склад',
    TAKE_SIM: '🚲 Взять Велосипед',
    CLEAR_WAREHOUSE: '❌🏠 Отвязаться от склада',
    RETURN_SIM: '🚲❌ Сдать Велосипед'
} as const;

// Исторический текст кнопки выбора склада (без пробела)
export const LEGACY_KEYBOARD_BUTTON_TEXT = {
    SELECT_WAREHOUSE: '🏠Выбрать склад'
} as const;

// Callback data для inline-кнопок
export const INLINE_CALLBACK_DATA = {
    TAKE_SIM: 'take_sim',
    SET_WAREHOUSE: 'set_warehouse',
    CLEAR_WAREHOUSE: 'clear_warehouse',
    WAREHOUSE_SELECT_PREFIX: 'warehouse_select_',
    TAKE_SIM_SELECT_PREFIX: 'take_sim_select_',
    RETURN_DAMAGE_NO: 'return_damage_no',
    RETURN_DAMAGE_YES: 'return_damage_yes',
    RETURN_DAMAGE_WEAK: 'return_damage_weak',
    RETURN_DAMAGE_CRITICAL: 'return_damage_critical'
} as const;
