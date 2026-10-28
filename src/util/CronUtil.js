/**
 * Spring cron(초 분 시 일 월 요일) ↔ 화면 입력(시각 + 요일) 변환
 * - 화면은 "매주 지정 요일 HH:mm" 형태만 다룸, 그 외 형식은 직접 입력으로 편집
 * - 요일 번호는 Spring 기준: 0/7=일, 1=월 … 6=토
 */

export const WEEKDAYS = [
    { value: 1, label: '월' },
    { value: 2, label: '화' },
    { value: 3, label: '수' },
    { value: 4, label: '목' },
    { value: 5, label: '금' },
    { value: 6, label: '토' },
    { value: 0, label: '일' },
];

export const ALL_DAYS = WEEKDAYS.map((d) => d.value);
export const BUSINESS_DAYS = [1, 2, 3, 4, 5];

/** 이 시각 이전(0~8시)은 PC가 꺼져 있어 실행이 조용히 누락됨 */
export const NIGHT_END_HOUR = 9;

const SUNDAY_ALT = 7;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;
const SIMPLE_CRON = /^0 (\d{1,2}) (\d{1,2}) \* \* (\S+)$/;
const DAY_TOKEN = /^[0-7](-[0-7])?$/;
// Spring 이 받는 영문 요일 이름 (예: "MON-FRI") → 번호
const DAY_NAMES = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
const DAY_NAME_PATTERN = new RegExp(Object.keys(DAY_NAMES).join('|'), 'g');

const normalizeDay = (d) => (d === SUNDAY_ALT ? 0 : d);

/** 요일 필드("*", "1-5", "0,6", "MON-FRI") → 요일 번호 배열, 해석 불가면 null */
const parseDayField = (field) => {
    if (field === '*' || field === '?') return [...ALL_DAYS];
    const numeric = field.toUpperCase().replace(DAY_NAME_PATTERN, (name) => String(DAY_NAMES[name]));
    const days = new Set();
    for (const token of numeric.split(',')) {
        if (!DAY_TOKEN.test(token)) return null;
        const [from, to = from] = token.split('-').map(Number);
        if (from > to) return null;
        for (let d = from; d <= to; d++) days.add(normalizeDay(d));
    }
    return [...days];
};

/**
 * cron → { hour, minute, days } (화면에서 다룰 수 없는 형식이면 null)
 */
export const parseSimpleCron = (cron) => {
    const m = SIMPLE_CRON.exec((cron || '').trim());
    if (!m) return null;
    const minute = Number(m[1]);
    const hour = Number(m[2]);
    if (minute > MAX_MINUTE || hour > MAX_HOUR) return null;
    const days = parseDayField(m[3]);
    if (!days || days.length === 0) return null;
    return { hour, minute, days };
};

/**
 * { hour, minute, days } → cron (요일 전체면 "*")
 */
export const buildSimpleCron = ({ hour, minute, days }) => {
    const unique = [...new Set(days.map(normalizeDay))];
    const dayField = unique.length === ALL_DAYS.length
        ? '*'
        : [...unique].sort((a, b) => a - b).join(',');
    return `0 ${minute} ${hour} * * ${dayField}`;
};

/**
 * 사람이 읽는 설명 (예: "매일 10:00", "평일 09:30", "월·수·금 14:00")
 */
export const describeCron = (cron) => {
    const parsed = parseSimpleCron(cron);
    if (!parsed) return `직접 설정 (${cron})`;
    const time = `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
    const set = new Set(parsed.days);
    let dayText;
    if (set.size === ALL_DAYS.length) dayText = '매일';
    else if (set.size === BUSINESS_DAYS.length && BUSINESS_DAYS.every((d) => set.has(d))) dayText = '평일';
    else dayText = WEEKDAYS.filter((d) => set.has(d.value)).map((d) => d.label).join('·');
    return `${dayText} ${time}`;
};

/** 야간(PC 꺼짐) 시간대 여부 */
export const isNightHour = (hour) => hour < NIGHT_END_HOUR;
