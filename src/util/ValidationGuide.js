/**
 * 투자 순위·매도 기준 검증 상태 공용 상수 (종목 발굴 안내, 홈 투자 순위 카드, 도움말)
 * 근거: test/backtest-exit-2026-10 PLAN3·PLAN4 — 순위 상위는 시장 평균 대비 +1.5%p(기준 +2%p 미달), 최신 목표가 매도는 두 표본 통과
 */
export const PENDING_LABEL = '검증 중';
export const VERIFIED_LABEL = '검증됨';
export const RANK_PENDING_NOTE = '순위가 높을수록 성과가 나았지만, 시장 평균보다 낫다는 것은 아직 확인되지 않았습니다.';
export const RANK_PENDING_TITLE = '시장 평균 대비 우위 미확정 — 종목 발굴 화면 안내 참고';
export const SELL_RULE_NOTE = '매도: 목표매도가(최신 기업가치 × 0.95) 도달 시 검토';
// 분산 기대 범위: 새 표본 1,451종목 2018~2025, 투자 순위 상위 20%에서 무작위 N종목 12개월 보유 (탐색값, 사전등록 아님)
export const DIVERSIFY_NOTE = '분산: 상위 종목을 20개 이상 나눠 담으면 12개월 수익 확률 약 73% · 하위 5% 손실 약 −16% (1종목은 58% · −42%, 백테스트 참고값)';

export const BADGE_BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold';
export const PENDING_BADGE = `${BADGE_BASE} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`;
export const VERIFIED_BADGE = `${BADGE_BASE} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300`;
