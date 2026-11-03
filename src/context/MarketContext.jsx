import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { MARKET, fmtPrice } from '@/util/MarketUtil';

const STORAGE_PREFIX = 'market:';

const loadMarket = (storageKey) => {
    try {
        const saved = localStorage.getItem(STORAGE_PREFIX + storageKey);
        return saved === MARKET.KR ? MARKET.KR : MARKET.US;
    } catch {
        return MARKET.US;
    }
};

const saveMarket = (storageKey, market) => {
    try {
        localStorage.setItem(STORAGE_PREFIX + storageKey, market);
    } catch { /* 저장 실패 무시 — 이번 화면에서만 유지 */ }
};

const MarketContext = createContext({ market: MARKET.US, setMarket: () => {} });

/**
 * 메뉴(종목 발굴 등) 단위 시장 선택 — 그 메뉴의 모든 하위 탭이 같은 시장을 본다, 마지막 선택을 기억
 * @param {string} storageKey 메뉴별 저장 키
 */
export function MarketProvider({ storageKey, children }) {
    const [market, setMarketState] = useState(() => loadMarket(storageKey));
    const setMarket = useCallback((next) => {
        setMarketState(next);
        saveMarket(storageKey, next);
    }, [storageKey]);
    const value = useMemo(() => ({ market, setMarket }), [market, setMarket]);
    return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

/** 현재 시장 — Provider 밖(홈 위젯 등)에서는 항상 미국 */
export const useMarket = () => useContext(MarketContext);

const krPrice = (v) => fmtPrice(v, MARKET.KR);

/**
 * 가격 표시 함수 — 국내면 원화 정수, 미국이면 화면이 쓰던 기존 함수 그대로 (미국 표시 불변)
 * @param {(v:any)=>string} usFormatter 미국 표시 함수
 */
export const usePriceFormatter = (usFormatter) => {
    const { market } = useMarket();
    return market === MARKET.KR ? krPrice : usFormatter;
};
