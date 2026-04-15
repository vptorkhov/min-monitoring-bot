import { DamageType } from '../../../services/session.service';

function normalizeAnswer(answer: string): string {
    return answer.trim().toLowerCase();
}

export function parseYesNo(answer: string): 'yes' | 'no' | null {
    const norm = normalizeAnswer(answer);
    if (/^\s*1\s*$/.test(answer) || norm === 'нет' || norm === 'no') {
        return 'no';
    }

    if (/^\s*2\s*$/.test(answer) || norm === 'да' || norm === 'yes') {
        return 'yes';
    }

    return null;
}

export function parseDamageType(answer: string): DamageType | null {
    const norm = normalizeAnswer(answer);
    if (/^\s*1\s*$/.test(answer) || norm === 'слабое' || norm === 'weak') {
        return 'warning';
    }

    if (/^\s*2\s*$/.test(answer) || norm === 'критическое' || norm === 'critical') {
        return 'broken';
    }

    return null;
}
