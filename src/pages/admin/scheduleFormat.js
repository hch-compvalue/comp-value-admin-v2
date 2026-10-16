/**
 * 스케줄 관리 화면 공통 포맷 함수
 */

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const DATETIME_TEXT_LENGTH = 16; // "yyyy-MM-ddTHH:mm"

/** 서버 LocalDateTime(ISO) → "yyyy-MM-dd HH:mm" */
export const formatDateTime = (iso) => (iso ? iso.slice(0, DATETIME_TEXT_LENGTH).replace('T', ' ') : '-');

/** 실행 소요 시간 ("2시간 13분", 실행 중이면 현재까지) */
export const formatDuration = (startedAt, endedAt) => {
    if (!startedAt) return '-';
    const end = endedAt ? new Date(endedAt) : new Date();
    const minutes = Math.max(0, Math.round((end - new Date(startedAt)) / MS_PER_MINUTE));
    const h = Math.floor(minutes / MINUTES_PER_HOUR);
    const m = minutes % MINUTES_PER_HOUR;
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};
