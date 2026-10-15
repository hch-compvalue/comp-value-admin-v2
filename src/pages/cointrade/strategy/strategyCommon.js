/**
 * 자동매매 대시보드(코인/주식 탭) 공통 상수·포맷 함수
 * 색상: 적록색약 배려 — 파랑(전략/정상) · 노랑/주황(비교/경고)
 */

export const API = '/dart/api/cointrade/strategy';
export const STATUS_REFRESH_MS = 60_000;
export const RUN_LIMIT = 90;
export const MIN_CAPITAL_KRW = 5000;
export const EMERGENCY_CONFIRM_WORD = '매도';
export const TOAST_MS = 3000;
export const COLOR_STRATEGY = '#3b82f6';
export const COLOR_BTC = '#f59e0b';

export const STRATEGY_COIN = 'btc_trend';
export const STRATEGY_STOCK = 'etf3_trend_v1';

export const MODES = [
    { key: 'OFF', label: '중지', desc: '실행 안 함' },
    { key: 'DRY_RUN', label: '확인 실행', desc: '판단·주문계획만 기록 (주문 없음)' },
    { key: 'LIVE', label: '실전', desc: '업비트 실제 주문' },
];

export const modeLabel = (key) => MODES.find((m) => m.key === key)?.label;

/** 전략 id를 쿼리로 붙인 API 주소 (생략 시 서버 기본값 btc_trend) */
export const strategyUrl = (path, strategyId) => `${API}${path}?strategy=${encodeURIComponent(strategyId)}`;

/** from~to 시각 목록 (양 끝 포함) */
export const hourRange = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => i + from);

export const fmtKrw = (v) => (v === null || v === undefined ? '-' : `${Math.round(v).toLocaleString('ko-KR')}원`);
export const fmtPct = (v, digits = 1) => (v === null || v === undefined ? '-' : `${(v * 100).toFixed(digits)}%`);
export const fmtSignedPct = (v) => (v === null || v === undefined ? '-' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`);
export const fmtBtc = (v) => (v === null || v === undefined ? '-' : Number(v).toFixed(8));
export const fmtShares = (v) => (v === null || v === undefined ? '-' : `${Math.floor(v).toLocaleString('ko-KR')}주`);
export const fmtDateTime = (iso) => (iso ? iso.replace('T', ' ').slice(0, 16) : '-');

export const INPUT_CLASS = 'h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed dark:disabled:bg-slate-800';

export const statusBadge = (status) => (status === 'SUCCESS'
    ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'
    : 'bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400');

export const actionLabel = { BUY: '매수', SELL: '매도', HOLD: '유지' };
