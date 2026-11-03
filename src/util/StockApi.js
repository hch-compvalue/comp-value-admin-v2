import { send, API_ENDPOINTS } from '@/util/ClientUtil';
import { MARKET } from '@/util/MarketUtil';

/**
 * 종목 분석 API — 시장(US/KR)별 주소를 한곳에서 고른다 (ROADMAP_domestic 5-B)
 * - 국내는 저장된 데이터만 읽어 호출 한도가 없다 (미국은 FMP)
 */

/** 종목 검색 → { list, error } (국내는 종목명·코드, 미국은 심볼·회사명) */
export const searchStocks = async (q, market = MARKET.US) => {
    const usp = new URLSearchParams(market === MARKET.KR ? { q } : { cn: q, symbol: q });
    const base = market === MARKET.KR ? '/dart/kr/stock/search' : '/dart/abroad/company/search/symbol';
    const { data, error } = await send(`${base}?${usp.toString()}`, {}, 'GET');
    return { list: Array.isArray(data?.response) ? data.response : [], error };
};

/** 적정가 계산 결과 → send 결과 그대로 */
export const fetchCompValue = (symbol, market = MARKET.US) =>
    send(market === MARKET.KR ? `/dart/kr/valuation/${encodeURIComponent(symbol)}` : API_ENDPOINTS.ABROAD_COMP_VALUE(symbol), {}, 'GET');

/** 6단계 평가 한 건 → { evaluation, message, error } (국내 계산 제외 종목은 evaluation null, message 에 사유) */
export const fetchEvaluation = async (symbol, market = MARKET.US) => {
    if (market === MARKET.KR) {
        const { data, error } = await send(`/dart/kr/valuation/${encodeURIComponent(symbol)}/evaluation`, {}, 'GET');
        return { evaluation: data?.response || null, message: data?.message, error };
    }
    const { data, error } = await send('/dart/main/evaluate/stocks', { symbols: [symbol] }, 'POST');
    return { evaluation: data?.response?.length > 0 ? data.response[0] : null, message: data?.message, error };
};

/** 기업정보 주소 */
export const companyProfileUrl = (symbol, market = MARKET.US) =>
    `${market === MARKET.KR ? '/dart/kr/stock/profile' : '/dart/abroad/company/search/profile'}?symbol=${encodeURIComponent(symbol)}`;
