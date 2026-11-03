/**
 * 스케줄 관리 맨 위 "하루 타임라인" 데이터 가공
 * - 막대 = 시작 시각 ~ 최근 성공 실행의 소요 시간 중앙값 (이력이 없으면 시작 시각 점만)
 * - 경고 = 앞 작업(after)이 평소대로 끝나기 전 또는 직후(SAFE_GAP_MINUTES 안)에 시작하는 작업
 */
import { ALL_DAYS, BUSINESS_DAYS, parseSimpleCron } from '@/util/CronUtil';
import { jobMetaOf } from '@/config/scheduleJobMeta';
import { DB_BACKUP_SCHEDULE } from '@/config/scheduleExternal';

export const TIMELINE_START_HOUR = 8;
export const TIMELINE_END_HOUR = 20;
/** 앞 작업이 끝난 뒤 최소 이만큼은 비어 있어야 안전 */
export const SAFE_GAP_MINUTES = 10;
/** 소요 시간 계산에 쓰는 최근 성공 실행 수 */
const DURATION_SAMPLE = 5;

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60 * 1000;
const SUCCESS = 'SUCCESS';
const MODE_OFF = 'OFF';
const MARKET_CRYPTO = 'CRYPTO';
const STRATEGY_MARKET_LABEL = { CRYPTO: '코인', KRX: '주식' };

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** 최근 성공 실행의 소요 시간 중앙값(분), 이력이 없으면 null */
export function typicalDurationMinutes(history = []) {
    const minutes = history
        .filter((h) => h.status === SUCCESS && h.startedAt && h.endedAt)
        .slice(0, DURATION_SAMPLE)
        .map((h) => (new Date(h.endedAt) - new Date(h.startedAt)) / MS_PER_MINUTE)
        .filter((m) => m >= 0);
    return minutes.length ? Math.round(median(minutes)) : null;
}

/** 분 → "1시간 4분" / "35분" / "1분 미만" */
export function formatMinutes(min) {
    if (min == null) return '기록 없음';
    if (min < 1) return '1분 미만';
    const h = Math.floor(min / MINUTES_PER_HOUR);
    const m = min % MINUTES_PER_HOUR;
    return h > 0 ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`;
}

/** 분(0~1439) → "HH:mm" */
export const minuteText = (min) => `${String(Math.floor(min / MINUTES_PER_HOUR) % 24).padStart(2, '0')}:${String(min % MINUTES_PER_HOUR).padStart(2, '0')}`;

/** 관리 중인 작업 → 타임라인 행 (cron 을 요일·시각으로 못 읽으면 start=null) */
function jobRow(job, history) {
    const parsed = parseSimpleCron(job.cronExpression);
    return {
        key: job.jobKey,
        label: job.label,
        market: jobMetaOf(job.jobKey).market,
        start: parsed ? parsed.hour * MINUTES_PER_HOUR + parsed.minute : null,
        days: parsed?.days ?? [],
        duration: typicalDurationMinutes(history),
        enabled: job.enabled,
        running: job.running,
        external: false,
    };
}

/** 자동매매 전략 → 타임라인 행 (실행 시각 이후 첫 확인 때 1회 — 소요 시간은 매우 짧아 점으로 표시) */
function strategyRow(strategy) {
    return {
        key: `strategy:${strategy.id}`,
        label: `자동매매 · ${STRATEGY_MARKET_LABEL[strategy.market] || strategy.market}`,
        market: null,
        start: strategy.runHour != null ? strategy.runHour * MINUTES_PER_HOUR : null,
        days: strategy.market === MARKET_CRYPTO ? [...ALL_DAYS] : [...BUSINESS_DAYS],
        duration: null,
        enabled: strategy.mode !== MODE_OFF,
        running: false,
        external: true,
    };
}

function backupRow(history) {
    return {
        key: 'db-backup',
        label: DB_BACKUP_SCHEDULE.label,
        market: null,
        start: DB_BACKUP_SCHEDULE.startHour * MINUTES_PER_HOUR + DB_BACKUP_SCHEDULE.startMinute,
        days: [...ALL_DAYS],
        duration: typicalDurationMinutes(history),
        enabled: true,
        running: false,
        external: true,
    };
}

/**
 * 타임라인 행 (시작 시각 순, 시각을 모르는 행은 맨 뒤)
 */
export function buildTimelineRows({ jobs = [], histories = {}, strategies = [], backupHistory = [] }) {
    const rows = [
        ...jobs.map((j) => jobRow(j, histories[j.jobKey])),
        ...strategies.map(strategyRow),
        backupRow(backupHistory),
    ];
    return rows
        .map((r, i) => ({ r, i }))
        .sort((a, b) => (a.r.start ?? Infinity) - (b.r.start ?? Infinity) || a.i - b.i)
        .map(({ r }) => r);
}

/** 작업 목록을 시작 시각 순으로 (타임라인과 같은 순서) */
export function sortJobsByStart(jobs) {
    const startOf = (j) => {
        const p = parseSimpleCron(j.cronExpression);
        return p ? p.hour * MINUTES_PER_HOUR + p.minute : Infinity;
    };
    return jobs.map((j, i) => ({ j, i })).sort((a, b) => startOf(a.j) - startOf(b.j) || a.i - b.i).map(({ j }) => j);
}

const sharesDay = (a, b) => a.days.some((d) => b.days.includes(d));

/**
 * 순서 경고 — 앞 작업이 평소 끝나는 시각 + SAFE_GAP_MINUTES 보다 먼저 시작하는 작업
 * @returns {{key, before, after, gap}[]} gap: 앞 작업 평소 종료 ~ 이 작업 시작 (분, 음수면 겹침)
 */
export function buildOrderWarnings(rows) {
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const warnings = [];
    rows.forEach((row) => {
        if (row.external || !row.enabled || row.start == null) return;
        jobMetaOf(row.key).after?.forEach((beforeKey) => {
            const before = byKey.get(beforeKey);
            if (!before?.enabled || before.start == null || before.duration == null || !sharesDay(before, row)) return;
            const gap = row.start - (before.start + before.duration);
            if (gap < SAFE_GAP_MINUTES) warnings.push({ key: row.key, before, after: row, gap });
        });
    });
    return warnings;
}

/** 지금 시각(분) — 브라우저 시간 기준 (서버와 같은 KST 가정) */
export const nowMinute = (date = new Date()) => date.getHours() * MINUTES_PER_HOUR + date.getMinutes();

/** 표시 구간 — 기본 08~20시, 그 밖의 작업이 있으면 넓힘 */
export function timelineRange(rows) {
    let from = TIMELINE_START_HOUR * MINUTES_PER_HOUR;
    let to = TIMELINE_END_HOUR * MINUTES_PER_HOUR;
    rows.forEach((r) => {
        if (r.start == null) return;
        from = Math.min(from, Math.floor(r.start / MINUTES_PER_HOUR) * MINUTES_PER_HOUR);
        to = Math.max(to, Math.ceil((r.start + (r.duration ?? 0)) / MINUTES_PER_HOUR) * MINUTES_PER_HOUR);
    });
    return { from, to: Math.min(to, 24 * MINUTES_PER_HOUR) };
}
