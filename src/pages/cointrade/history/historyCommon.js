/**
 * 거래기록 화면 공통 — 시장(코인/주식) 구분, 현재 전략 vs 구 전략(v4 단타) 구분, 집계 함수
 * 색상: 적록색약 배려 — 코인 파랑 · 주식 호박/주황, 이익 파랑 · 손실 주황
 */
import { send } from '@/util/ClientUtil';

export const HISTORY_API = '/dart/api/cointrade/history';
export const HISTORY_CODES_API = '/dart/api/cointrade/history/codes';
export const STRATEGY_LIST_API = '/dart/api/cointrade/strategy/list';

export const MARKET = { CRYPTO: 'CRYPTO', KRX: 'KRX' };
const CRYPTO_CODE_PREFIX = 'KRW-';

/** 상단 탭 — market: 백엔드 market 파라미터 (null = 전체) */
export const HISTORY_TABS = [
    { key: 'all', label: '전체', market: null },
    { key: 'coin', label: '코인', market: MARKET.CRYPTO },
    { key: 'stock', label: '주식', market: MARKET.KRX },
];
const TAB_STORAGE_KEY = 'tradeHistory:tab';
const LEGACY_STORAGE_KEY = 'tradeHistory:includeLegacy';

export const tabMarket = (tabKey) => HISTORY_TABS.find((t) => t.key === tabKey)?.market ?? null;

/** 자동매매 화면 탭 키 (전략 수익률 링크용) */
export const DASHBOARD_TAB_BY_MARKET = { [MARKET.CRYPTO]: 'coin', [MARKET.KRX]: 'stock' };

export const MARKET_META = {
    [MARKET.CRYPTO]: {
        label: '코인',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    },
    [MARKET.KRX]: {
        label: '주식',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
};

/** 현재 전략(코인 btc_trend / 주식 etf3_trend_v1)이 남기는 사유 — 이외는 구 전략(v4 단타) 기록 */
export const CURRENT_REASONS = ['TREND_REBALANCE', 'EMERGENCY_EXIT'];

export const COIN_QTY_DECIMALS = 8;
export const STOCK_QTY_DECIMALS = 0;

/** 전체 보기 페이지 크기 (이 크기로 조회했을 때만 요약 집계가 정확) */
export const PAGE_SIZE_ALL = 9999;

export const marketOf = (code) => (code?.startsWith(CRYPTO_CODE_PREFIX) ? MARKET.CRYPTO : MARKET.KRX);
export const isLegacyRecord = (r) => !CURRENT_REASONS.includes(r?.reason);
export const qtyDecimalsOf = (code) => (marketOf(code) === MARKET.CRYPTO ? COIN_QTY_DECIMALS : STOCK_QTY_DECIMALS);

/** 종목 표시명 "이름 · 코드" (이름을 모르면 코드만) */
export const displayName = (code, nameMap) => {
    if (!code) return '-';
    const name = nameMap?.[code];
    return name ? `${name} · ${code}` : code;
};

/** 표시용 수치 — 현재 전략 기록은 원/주 단위 정수, 구 전략 기록은 원값 그대로(소수 가격 코인 존재) */
export const displayKrw = (value, record) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return isLegacyRecord(record) ? num : Math.round(num);
};

export const formatQty = (value, code) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return '-';
    const decimals = qtyDecimalsOf(code);
    return decimals === STOCK_QTY_DECIMALS ? `${Math.floor(num).toLocaleString('en-US')}주` : num.toFixed(decimals);
};

// ===== localStorage (실패 시 기본값) =====
export const loadSavedTab = () => {
    try {
        const saved = localStorage.getItem(TAB_STORAGE_KEY);
        if (HISTORY_TABS.some((t) => t.key === saved)) return saved;
    } catch { /* 저장소 접근 불가 시 기본 탭 */ }
    return HISTORY_TABS[0].key;
};

export const saveTab = (key) => {
    try { localStorage.setItem(TAB_STORAGE_KEY, key); } catch { /* 저장 실패 무시 */ }
};

export const loadSavedLegacy = () => {
    try { return localStorage.getItem(LEGACY_STORAGE_KEY) === 'true'; } catch { return false; }
};

export const saveLegacy = (on) => {
    try { localStorage.setItem(LEGACY_STORAGE_KEY, String(on)); } catch { /* 저장 실패 무시 */ }
};

// ===== API =====
/** 전략 목록에서 종목코드 → 표시명 맵 생성 (실패 시 빈 맵 → 코드로 표시) */
export const fetchSymbolNames = async () => {
    const { data, error } = await send(STRATEGY_LIST_API, {}, 'GET');
    if (error || !data?.success) return {};
    const strategies = data.response?.strategies ?? [];
    return strategies.reduce((map, s) => {
        (s.assets ?? []).forEach((a) => { if (a.symbol && a.name) map[a.symbol] = a.name; });
        return map;
    }, {});
};

// ===== 집계 =====
const sumAmount = (rows) => rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);

/** 매수/매도 흐름 + 매도 실현 손익 집계 (현재 전략: 손익은 2026-10-19 이후 매도부터 기록) */
export const computeFlow = (rows) => {
    const buys = rows.filter((r) => r.tradeType === 'BUY');
    const sells = rows.filter((r) => r.tradeType === 'SELL');
    const buyAmount = sumAmount(buys);
    const sellAmount = sumAmount(sells);
    const pnlSells = sells.filter((r) => r.profitLoss != null);
    const realizedPnl = pnlSells.reduce((s, r) => s + Number(r.profitLoss), 0);
    const pnlBasis = pnlSells.reduce((s, r) => s + (Number(r.totalAmount) || 0) - Number(r.profitLoss), 0);
    return {
        realizedPnl,
        realizedRate: pnlBasis > 0 ? realizedPnl / pnlBasis * 100 : null,
        pnlSellCount: pnlSells.length,
        count: rows.length,
        buyCount: buys.length,
        buyAmount,
        sellCount: sells.length,
        sellAmount,
        netBuy: buyAmount - sellAmount,
    };
};

/** 시장별 흐름 집계 { CRYPTO: flow, KRX: flow } */
export const computeFlowByMarket = (rows) => ({
    [MARKET.CRYPTO]: computeFlow(rows.filter((r) => marketOf(r.coinCode) === MARKET.CRYPTO)),
    [MARKET.KRX]: computeFlow(rows.filter((r) => marketOf(r.coinCode) === MARKET.KRX)),
});

/** 종목별 흐름 집계 (매수+매도 금액 내림차순) */
export const computeFlowBySymbol = (rows) => {
    const bySymbol = new Map();
    rows.forEach((r) => {
        const code = r.coinCode || '-';
        if (!bySymbol.has(code)) bySymbol.set(code, []);
        bySymbol.get(code).push(r);
    });
    return Array.from(bySymbol.entries())
        .map(([code, list]) => ({ code, market: marketOf(code), ...computeFlow(list) }))
        .sort((a, b) => (b.buyAmount + b.sellAmount) - (a.buyAmount + a.sellAmount));
};

/** 구 전략(v4) 매도 사유 그룹 */
export const LEGACY_REASON_GROUPS = [
    { key: 'takeProfit', label: '익절', match: (r) => ['TAKE_PROFIT', 'PARTIAL_TAKE_PROFIT'].includes(r) },
    { key: 'stopLoss', label: '손절', match: (r) => ['STOP_LOSS', 'PARTIAL_STOP_LOSS'].includes(r) },
    { key: 'trailingStop', label: '트레일링스탑', match: (r) => ['TRAILING_STOP', 'PARTIAL_TRAILING_STOP'].includes(r) },
    { key: 'maxHoldExpired', label: '강제청산', match: (r) => ['MAX_HOLD_EXPIRED', 'MAX_HOLDING_EXPIRED'].includes(r) },
    { key: 'manual', label: '수동매도', match: (r) => ['MANUAL', 'PARTIAL_MANUAL', 'MANUAL_CLEANUP', 'CLEANUP_NO_BALANCE'].includes(r) },
    { key: 'expired', label: '만료매도', match: (r) => r === 'EXPIRED' || /^(PARTIAL_)?\d+DAY_PROFIT$/.test(r ?? '') },
];

/** 구 전략(v4) 손익 집계 — 승률·실현손익·사유별 건수/손익 */
export const computeLegacyStats = (rows) => {
    const flow = computeFlow(rows);
    const sells = rows.filter((r) => r.tradeType === 'SELL');
    const totalProfit = sells.reduce((s, r) => s + (r.profitLoss || 0), 0);

    // 승률: 수익 매도(profitLoss > 0) 건수 / 전체 매도 건수
    const winCount = sells.filter((r) => (r.profitLoss || 0) > 0).length;
    const winRate = sells.length > 0 ? (winCount / sells.length) * 100 : 0;

    // 실현 수익률: 매도 원금 = 매도금액 - 손익, 수익률 = 손익 / 원금 * 100
    const sellCostBasis = flow.sellAmount - totalProfit;
    const realizedProfitRate = sellCostBasis > 0 ? (totalProfit / sellCostBasis) * 100 : 0;

    const reasons = LEGACY_REASON_GROUPS.map(({ key, label, match }) => {
        const matched = sells.filter((r) => match(r.reason));
        return { key, label, count: matched.length, amount: matched.reduce((s, r) => s + (r.profitLoss || 0), 0) };
    });

    return { ...flow, winCount, winRate, totalProfit, realizedProfitRate, reasons };
};
