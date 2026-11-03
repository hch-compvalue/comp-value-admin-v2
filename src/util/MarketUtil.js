/**
 * 시장(미국/국내) 공통 — 시장 코드·라벨·금액 표시 (ROADMAP_domestic 5단계)
 * - 서버 API 의 market 파라미터와 같은 값 (US / KR)
 */
export const MARKET = { US: 'US', KR: 'KR' };

export const MARKET_OPTIONS = [
    { value: MARKET.US, label: '미국주식' },
    { value: MARKET.KR, label: '국내주식' },
];

/** 성과추적 기준 지수 (서버 응답에 benchmarkSymbol 이 없을 때 대체) */
export const BENCHMARK_LABEL = { [MARKET.US]: 'SPY', [MARKET.KR]: 'KOSPI' };

const JO = 1_000_000_000_000;
const EOK = 100_000_000;

/** 가격: 미국 $1,234.56 / 국내 1,234원 (정수) */
export const fmtPrice = (v, market = MARKET.US) => {
    if (v == null || v === '' || Number.isNaN(Number(v))) return '-';
    const n = Number(v);
    if (market === MARKET.KR) return `${Math.round(n).toLocaleString('ko-KR')}원`;
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** 금액(시가총액 등): 미국 $1.2B / 국내 1.2조원·3,450억원 */
export const fmtAmount = (v, market = MARKET.US) => {
    if (v == null || v === '' || Number.isNaN(Number(v))) return '-';
    const n = Number(v);
    if (market === MARKET.KR) {
        if (Math.abs(n) >= JO) return `${(n / JO).toFixed(1)}조원`;
        return `${Math.round(n / EOK).toLocaleString('ko-KR')}억원`;
    }
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${Math.round(n).toLocaleString('en-US')}`;
};

/**
 * 원화 금액 ₩1,234 (포트폴리오 표기 — 기존 원화 환산 표시와 같은 ₩ 형식)
 * @param {{ signed?: boolean }} [opts] signed: 양수에 + 표시
 */
export const fmtKrw = (v, { signed = false } = {}) => {
    if (v == null || v === '' || Number.isNaN(Number(v))) return '-';
    const n = Number(v);
    const sign = n < 0 ? '-' : signed && n > 0 ? '+' : '';
    return `${sign}₩${Math.round(Math.abs(n)).toLocaleString('ko-KR')}`;
};

/** 국내면 원화(₩), 미국이면 화면이 쓰던 문자열 그대로 (미국 표시 불변) */
export const krwOr = (isKr, v, usText, opts) => (isKr ? fmtKrw(v, opts) : usText);
