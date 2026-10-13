/**
 * 통합 메뉴 경로와 하위 탭 키
 * - routes.jsx와 페이지 컴포넌트가 함께 참조하므로 순환 import를 피하려고 별도 파일로 분리
 */
export const STOCK_DISCOVER_PATH = '/stock/discover';
export const STOCK_ANALYSIS_PATH = '/stock/analysis';
export const PORTFOLIO_PATH = '/portfolio';

export const SUB_TAB = {
    DAILY_PICKS: 'daily',
    PROFILE_SETTINGS: 'profiles',
    PERFORMANCE: 'performance',
    SEARCH: 'search',
    EVALUATE: 'evaluate',
    HOLDINGS: 'holdings',
    SELL_RECORD: 'sell-record',
};
