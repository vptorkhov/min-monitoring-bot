// src/validators/phone.validator.ts

// Функция для очистки номера телефона от лишних символов
export function cleanPhoneNumber(phone: string): string {
    return phone.replace(/[\s\-\(\)\+]/g, '');
}

// Проверка, что номер состоит только из цифр после очистки
export function containsOnlyDigits(phone: string): boolean {
    return /^\d+$/.test(phone);
}

// Основная функция валидации номера телефона
export function validatePhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') {
        return false;
    }

    const cleaned = cleanPhoneNumber(phone);

    // Проверка что номер состоит только из цифр
    if (!containsOnlyDigits(cleaned)) {
        return false;
    }

    // Проверка длины (минимальная международная длина номера)
    if (cleaned.length < 10 || cleaned.length > 15) {
        return false;
    }

    return true;
}

// Функция для форматирования номера в читаемый вид (опционально)
export function formatPhoneNumber(phone: string): string {
    const cleaned = cleanPhoneNumber(phone);

    // Простое форматирование: +7 (999) 999-99-99 для российских номеров
    if (cleaned.length === 11 && (cleaned.startsWith('7') || cleaned.startsWith('8'))) {
        const countryCode = '7';
        const areaCode = cleaned.substring(1, 4);
        const firstPart = cleaned.substring(4, 7);
        const secondPart = cleaned.substring(7, 9);
        const thirdPart = cleaned.substring(9, 11);

        return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}-${thirdPart}`;
    }

    // Для остальных номеров возвращаем с +
    return `+${cleaned}`;
}