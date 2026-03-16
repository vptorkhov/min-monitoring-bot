export {
    INLINE_CALLBACK_DATA,
    KEYBOARD_BUTTON_TEXT,
    LEGACY_KEYBOARD_BUTTON_TEXT
} from './keyboard.constants';

export {
    getRegistrationStartKeyboard,
    getCancelKeyboard
} from './registration-flow.keyboard';

export {
    getSelectWarehouseKeyboard,
    getCourierIdleKeyboard,
    getCourierActiveSessionKeyboard,
    getCourierMainInlineKeyboard
} from './courier-actions.keyboard';

export {
    getWarehouseNumberSelectionKeyboard,
    getWarehouseNumberSelectionInlineKeyboard
} from './warehouse-selection.keyboard';

export {
    getTakeSimNumberSelectionKeyboard,
    getTakeSimNumberSelectionInlineKeyboard
} from './sim-selection.keyboard';

export {
    getReturnSimDamageQuestionKeyboard,
    getReturnSimDamageQuestionInlineKeyboard,
    getReturnSimDamageTypeKeyboard,
    getReturnSimDamageTypeInlineKeyboard
} from './return-sim.keyboard';
