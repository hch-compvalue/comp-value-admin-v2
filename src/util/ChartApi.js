import { send } from './ClientUtil';

/**
 * 거래소 대표지수 차트 데이터 조회
 * @param {string} symbol - 지수 심볼 (예: ^GSPC, ^DJI, ^IXIC)
 * @param {string} from - 시작일 (YYYY-MM-DD)
 * @param {string} to - 종료일 (YYYY-MM-DD)
 * @returns {Promise<{ data: any, error: string|null }>}
 */
export const fetchIndexChart = async (symbol, from, to) => {
    const params = { symbol, from, to };
    return await send('/dart/abroad/chart/historical-index', params, 'POST');
};

/**
 * 국내 지수 차트 데이터 조회 (저장된 지수 일봉 + 최근분 KIS 보충, 미국 지수와 같은 응답 형식)
 * @param {string} symbol - KOSPI / KOSDAQ
 * @param {string} from - 시작일 (YYYY-MM-DD)
 * @returns {Promise<{ data: any, error: string|null }>}
 */
export const fetchKrIndexChart = async (symbol, from) => send('/dart/kr/index/chart', { symbol, from }, 'GET');

/**
 * 주식 가격 및 거래량 차트 데이터 조회
 * @param {string} symbol - 주식 심볼 (예: AAPL, TSLA, GOOGL)
 * @param {string} from - 시작일 (YYYY-MM-DD)
 * @param {string} to - 종료일 (YYYY-MM-DD)
 * @param {string} market - US(FMP) / KR(저장된 국내 일봉, 같은 응답 형식)
 * @returns {Promise<{ data: any, error: string|null }>}
 */
export const fetchStockPriceVolume = async (symbol, from, to, market = 'US') => {
    const params = { symbol, from, to };
    return await send(market === 'KR' ? '/dart/kr/stock/chart' : '/dart/abroad/chart/stock-price-volume', params, 'POST');
};
