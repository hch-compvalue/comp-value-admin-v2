/**
 * 정렬 키 (utils/sorting.js 비교 기준과 1:1)
 */
export const SORT_KEYS = Object.freeze({
    SYMBOL: 'symbol',
    BUY_PRICE: 'buyPrice',
    CUR_PRICE: 'curPrice',
    QTY: 'qty',
    BUY_AMOUNT: 'buyAmount',
    EVAL_AMOUNT: 'evalAmount',
    PNL: 'pnl',
    BUY_DATE: 'buyDate',
});

/**
 * 보유종목 테이블 컬럼 정의 (헤더·너비·정렬·정렬키 단일 출처)
 * - key: holdings/cells.jsx CELL_RENDERERS 키
 * - align: 헤더와 셀 정렬을 같이 맞춤 (숫자는 right)
 * - sortKey: null 이면 정렬 불가
 * 컬럼 추가/순서 변경은 이 배열 + CELL_RENDERERS 만 수정
 */
export const TABLE_COLUMNS = [
    { key: 'symbol', label: '종목', width: 'w-56', align: 'left', sortKey: SORT_KEYS.SYMBOL },
    { key: 'qty', label: '수량', width: 'w-16', align: 'right', sortKey: SORT_KEYS.QTY },
    { key: 'buyPrice', label: '매수가', width: 'w-28', align: 'right', sortKey: SORT_KEYS.BUY_PRICE },
    { key: 'curPrice', label: '현재가', width: 'w-40', align: 'right', sortKey: SORT_KEYS.CUR_PRICE },
    { key: 'evalAmount', label: '평가금액', width: 'w-36', align: 'right', sortKey: SORT_KEYS.EVAL_AMOUNT },
    { key: 'pnl', label: '손익', width: 'w-52', align: 'right', sortKey: SORT_KEYS.PNL },
    { key: 'buyDate', label: '매수일', width: 'w-28', align: 'center', sortKey: SORT_KEYS.BUY_DATE },
    { key: 'rmk', label: '비고', width: 'w-32', align: 'left', sortKey: null },
];

/**
 * 테이블 금액 표시 통화 (KRW 는 현재 환율 환산)
 */
export const CURRENCIES = Object.freeze({ USD: 'USD', KRW: 'KRW' });

/**
 * 필터 모드
 */
export const FILTER_MODES = { ALL: 'all', PROFIT: 'profit', LOSS: 'loss' };

/**
 * 신규 행 초기값
 */
export const INITIAL_NEW_ROW = {
    symbol: '',
    companyName: '',
    buyPrice: '',
    totalBuyAmount: '',
    buyDate: '',
    currentPrice: '',
    targetPrice: '',
    targetPriceSync: false,
    rmk: '',
};
