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

// 국내 검증 결과 — 근거: test/backtest-kr-2026-11 RESULTS.md (2026-11-03, 2024-04~2026-10 주간 135시점, 개발+봉인 1회)
// 적정가 괴리율 12주 순위 예측력: 개발 IC +0.16 · 봉인 +0.11 통과 / 투자 순위 점수 불통과 / 금융은 표본 부족으로 미검증
export const KR_FAIR_VALUE_NOTE = '국내 적정가는 국내 데이터로 검증했습니다 — 적정가보다 싸게 거래되는 종목일수록 12주 뒤 성과가 나은 경향이 두 구간 모두 확인됐습니다. 금융주는 데이터 부족으로 검증하지 못했고, 시장 평균보다 낫다는 보장은 아닙니다.';
export const KR_RANK_NOTE = '국내 백테스트에서 투자 순위는 성과 예측력이 없었고, 매수 대상 종목은 오히려 다른 후보보다 성과가 낮았습니다. 그래서 국내는 전체 후보를 가치점수 순으로 먼저 보여줍니다(참고용).';
