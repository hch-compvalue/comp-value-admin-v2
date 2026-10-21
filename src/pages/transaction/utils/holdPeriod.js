import { HOLD_DEADLINE_MONTHS, DEADLINE_SOON_DAYS } from '@/util/TradingRule';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS_PER_YEAR = 12;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** 'YYYY-MM-DD' → 로컬 자정 Date (new Date('YYYY-MM-DD')는 UTC 해석이라 직접 분해) */
function parseLocalDate(s) {
    const m = DATE_RE.exec(String(s || ''));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}

/** n개월 뒤 같은 날 (없는 날은 그 달 말일, 예: 2월 29일 → 다음 해 2월 28일) */
function addMonths(date, n) {
    const y = date.getFullYear();
    const mo = date.getMonth() + n;
    const lastDay = new Date(y, mo + 1, 0).getDate();
    return new Date(y, mo, Math.min(date.getDate(), lastDay));
}

/** 꽉 채운 경과 개월 수 */
function fullMonthsBetween(from, to) {
    const months = (to.getFullYear() - from.getFullYear()) * MONTHS_PER_YEAR + (to.getMonth() - from.getMonth());
    return to.getDate() < from.getDate() ? months - 1 : months;
}

/**
 * 매수일 기준 보유 경과·매도 기한
 * @param {string} buyDate 'YYYY-MM-DD'
 * @param {Date} today 기준일 (기본: 오늘)
 * @returns {{months:number, deadline:Date, daysLeft:number, expired:boolean, soon:boolean}|null} 매수일이 없거나 형식이 다르면 null
 */
export function calcHoldPeriod(buyDate, today = new Date()) {
    const start = parseLocalDate(buyDate);
    if (!start) return null;
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const deadline = addMonths(start, HOLD_DEADLINE_MONTHS);
    const daysLeft = Math.round((deadline - base) / MS_PER_DAY);
    return {
        months: Math.max(0, fullMonthsBetween(start, base)),
        deadline,
        daysLeft,
        expired: daysLeft <= 0,
        soon: daysLeft > 0 && daysLeft <= DEADLINE_SOON_DAYS,
    };
}

/** 가장 이른 매수일 (그룹 합계 행 기한 = 가장 먼저 기한이 오는 매수 건) */
export function earliestBuyDate(rows) {
    return rows
        .map((r) => String(r.buyDate || ''))
        .filter((s) => DATE_RE.test(s))
        .sort()[0] || '';
}
