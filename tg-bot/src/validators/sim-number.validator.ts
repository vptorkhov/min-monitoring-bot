// src/validators/sim-number.validator.ts

const LATIN_LETTERS = /[A-Za-z]/;
const CYRILLIC_LETTERS = /[А-ЯЁа-яё]/;
const DIGITS = /[0-9]/;

/**
 * Проверяет, является ли символ допустимой буквой (латиница или кириллица)
 */
function isLetter(char: string): boolean {
    return LATIN_LETTERS.test(char) || CYRILLIC_LETTERS.test(char);
}

/**
 * Проверяет, является ли символ цифрой
 */
function isDigit(char: string): boolean {
    return DIGITS.test(char);
}

/**
 * Валидация номера СИМ.
 * Допустимый формат: ровно 6 символов, из которых ровно 3 — буквы
 * (латинские или кириллица) и ровно 3 — цифры, в произвольном порядке.
 * Примеры: АА000А, ABC123, 1A2B3C
 */
export function validateSimNumber(input: string): boolean {
    if (!input || input.length !== 6) {
        return false;
    }

    let letterCount = 0;
    let digitCount = 0;

    for (const char of input) {
        if (isLetter(char)) {
            letterCount++;
        } else if (isDigit(char)) {
            digitCount++;
        } else {
            return false;
        }
    }

    return letterCount === 3 && digitCount === 3;
}
