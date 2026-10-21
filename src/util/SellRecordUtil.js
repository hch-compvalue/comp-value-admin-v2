// 환차손익 계산: 매수원가($) = 매도금액($) - 실현손익($), 환차손익(₩) = 매수원가($) × (매도당시환율 - 매수당시환율)
export function calcFxPnl(record) {
    const { sellPrice, sellQty, realizedPnl, buyExchangeRateAtTrade, sellExchangeRateAtTrade } = record;
    if (!buyExchangeRateAtTrade || !sellExchangeRateAtTrade) return null;
    const buyCostUsd = sellPrice * sellQty - realizedPnl;
    return buyCostUsd * (sellExchangeRateAtTrade - buyExchangeRateAtTrade);
}

// 가격손익(₩) = 실현손익($) × 매도당시환율 — 주가가 오르내려 생긴 손익. 매도환율 없으면 대체 환율(현재 환율) 사용
export function calcPriceGainKrw(record, fallbackFxRate) {
    const sellRate = record.sellExchangeRateAtTrade || fallbackFxRate;
    if (!sellRate) return null;
    return record.realizedPnl * sellRate;
}

// 총손익(₩) = 가격손익(₩) + 환차손익(₩). 환율 정보 없으면 가격손익만 반영
export function calcTotalPnlKrw(record, fallbackFxRate) {
    const priceGainKrw = calcPriceGainKrw(record, fallbackFxRate);
    if (priceGainKrw === null) return null;
    return priceGainKrw + (calcFxPnl(record) || 0);
}

// 원화 손익 표시 (+₩1,234 / -₩1,234)
export const formatSignedKrw = (v) => `${v >= 0 ? '+' : '-'}₩${Math.abs(Math.round(v)).toLocaleString()}`;
