/**
 * 스케줄 관리 화면 공통 포맷 함수
 */

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const DATETIME_TEXT_LENGTH = 16; // "yyyy-MM-ddTHH:mm"

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DATE_TEXT_LENGTH = 10; // "yyyy-MM-dd"
const TIME_START = 11;        // "yyyy-MM-ddT" 다음

/** 서버 LocalDateTime(ISO) → "yyyy-MM-dd (화) HH:mm" (요일은 날짜 부분으로 계산 — 시간대 영향 없음) */
export const formatDateTime = (iso) => {
    if (!iso) return '-';
    const date = iso.slice(0, DATE_TEXT_LENGTH);
    const [y, m, d] = date.split('-').map(Number);
    const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
    return `${date} (${weekday}) ${iso.slice(TIME_START, DATETIME_TEXT_LENGTH)}`;
};

/** 실행 소요 시간 ("2시간 13분", 실행 중이면 현재까지) */
export const formatDuration = (startedAt, endedAt) => {
    if (!startedAt) return '-';
    const end = endedAt ? new Date(endedAt) : new Date();
    const minutes = Math.max(0, Math.round((end - new Date(startedAt)) / MS_PER_MINUTE));
    const h = Math.floor(minutes / MINUTES_PER_HOUR);
    const m = minutes % MINUTES_PER_HOUR;
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};
