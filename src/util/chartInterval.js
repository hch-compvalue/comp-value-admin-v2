/**
 * 차트 봉 단위(일봉·주봉·월봉·년봉) — 일별 시세를 봉 단위로 묶고, 봉 단위별 표시 개수·조회 기간을 관리
 * - FMP 는 일별 시세만 제공 → 주/월/년 봉은 프론트에서 집계
 */

/** FMP historical-price-eod 1회 최대 5,000행 ≈ 20년 → 그 이상은 조회해도 잘림 */
const MAX_FETCH_DAYS = 365 * 20;

/** 봉 단위 정의 — bars: 표시할 최근 봉 개수(null = 조회 가능한 전체), calendarDaysPerBar: 봉 1개당 달력일(조회 기간 계산용) */
export const CHART_INTERVALS = [
    { key: 'day', label: '일봉', unit: '일', bars: 120, calendarDaysPerBar: 1.5 }, // 거래일 → 달력일 (주말·휴일 보정)
    { key: 'week', label: '주봉', unit: '주', bars: 104, calendarDaysPerBar: 7 },
    { key: 'month', label: '월봉', unit: '개월', bars: 120, calendarDaysPerBar: 31 },
    { key: 'year', label: '년봉', unit: '년', bars: null, calendarDaysPerBar: 366 },
];

export const DEFAULT_INTERVAL = 'day';

/** 첫 봉이 이 일수 이상 늦게 시작하면 잘린 봉으로 보고 제외 (조회 시작일이 봉 중간인 경우) */
const PARTIAL_BUCKET_TOLERANCE_DAYS = { week: 3, month: 6, year: 14 };

const DAY_MS = 24 * 60 * 60 * 1000;

export const getInterval = (key) => CHART_INTERVALS.find((i) => i.key === key) || CHART_INTERVALS[0];

/**
 * 조회할 달력 일수 (표시 봉 + 지표 계산용 앞쪽 봉)
 * @param {string} key - 봉 단위
 * @param {number} lookbackBars - 활성 지표 중 가장 긴 계산 구간(봉)
 */
export function calcFetchDays(key, lookbackBars = 0) {
    const iv = getInterval(key);
    if (iv.bars == null) return MAX_FETCH_DAYS;
    return Math.min(MAX_FETCH_DAYS, Math.ceil((iv.bars + lookbackBars) * iv.calendarDaysPerBar));
}

/** 조회 시작일 (YYYY-MM-DD) */
export const fetchFromDate = (days) => new Date(Date.now() - days * DAY_MS).toISOString().split('T')[0];

const toUtc = (dateStr) => new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);

/** 날짜가 속한 봉의 시작일 (UTC) */
function bucketStart(dateStr, key) {
    const d = toUtc(dateStr);
    if (key === 'week') {
        const mondayOffset = (d.getUTCDay() + 6) % 7; // 월요일 시작
        return new Date(d.getTime() - mondayOffset * DAY_MS);
    }
    if (key === 'month') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

/** 같은 봉에 속한 일별 시세 → 봉 1개 (시가=첫날, 고가=최고, 저가=최저, 종가=마지막날, 거래량=합) */
function mergeDays(days) {
    const first = days[0];
    const last = days[days.length - 1];
    const volume = days.reduce((s, d) => s + (d.volume || 0), 0);
    const vwapWeighted = days.reduce((s, d) => s + (d.vwap || 0) * (d.volume || 0), 0);
    return {
        date: first.date,
        endDate: last.date,
        open: first.open,
        high: Math.max(...days.map((d) => d.high)),
        low: Math.min(...days.map((d) => d.low)),
        close: last.close,
        volume,
        vwap: volume > 0 ? vwapWeighted / volume : null,
    };
}

/**
 * 일별 시세(날짜 오름차순) → 봉 단위 시세
 * - 일봉은 그대로, 나머지는 집계 후 직전 봉 대비 change/changePercent 계산
 * - 조회 시작일 때문에 앞부분이 잘린 첫 봉은 제외
 */
export function aggregateBars(daily, key) {
    if (key === 'day' || !daily?.length) return daily || [];

    const buckets = [];
    let currentKey = null;
    for (const d of daily) {
        const start = bucketStart(d.date, key).getTime();
        if (start !== currentKey) {
            buckets.push({ start, days: [] });
            currentKey = start;
        }
        buckets[buckets.length - 1].days.push(d);
    }

    const firstLagDays = (toUtc(buckets[0].days[0].date).getTime() - buckets[0].start) / DAY_MS;
    if (buckets.length > 1 && firstLagDays >= PARTIAL_BUCKET_TOLERANCE_DAYS[key]) buckets.shift();

    return buckets.map((b, i) => {
        const bar = mergeDays(b.days);
        const prevClose = i > 0 ? buckets[i - 1].days[buckets[i - 1].days.length - 1].close : null;
        bar.change = prevClose != null ? bar.close - prevClose : null;
        bar.changePercent = prevClose ? (bar.change / prevClose) * 100 : null;
        return bar;
    });
}

/** 표시할 최근 봉만 남김 */
export function takeRecentBars(bars, key) {
    const { bars: count } = getInterval(key);
    return count == null ? bars : bars.slice(-count);
}

/** X축 눈금 — 일봉 M/D, 주·월봉 YY.MM, 년봉 YYYY */
export function intervalTickFormatter(key) {
    return (dateStr) => {
        const d = toUtc(dateStr);
        const yy = String(d.getUTCFullYear()).slice(2);
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        if (key === 'day') return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
        if (key === 'year') return String(d.getUTCFullYear());
        return `${yy}.${mm}`;
    };
}

/** 툴팁 날짜 — 일봉 YYYY.MM.DD, 주봉 YYYY.MM.DD 주, 월봉 YYYY년 M월, 년봉 YYYY년 */
export function intervalLabelFormatter(key) {
    return (dateStr) => {
        const d = toUtc(dateStr);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth() + 1;
        const ymd = `${y}.${String(m).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
        if (key === 'week') return `${ymd} 주`;
        if (key === 'month') return `${y}년 ${m}월`;
        if (key === 'year') return `${y}년`;
        return ymd;
    };
}

/** 캔들 Bar 의 dataKey — [저가, 고가] 범위 막대 (모양은 component/common/chart/CandleShape) */
export const candleRange = (d) => [d.low, d.high];

/**
 * 가격 축 범위 — 저가~고가(+ 표시 중인 지표 값)에 위아래 여백
 * @param {Array} data
 * @param {string[]} extraKeys - 함께 포함할 지표 키 (볼린저 밴드 등)
 */
export function priceDomain(data, extraKeys = []) {
    const PAD_RATIO = 0.05;
    let min = Infinity;
    let max = -Infinity;
    for (const d of data) {
        for (const v of [d.low, d.high, ...extraKeys.map((k) => d[k])]) {
            if (v == null || Number.isNaN(v)) continue;
            if (v < min) min = v;
            if (v > max) max = v;
        }
    }
    if (!Number.isFinite(min)) return ['auto', 'auto'];
    const pad = (max - min) * PAD_RATIO || max * PAD_RATIO;
    return [min - pad, max + pad];
}
