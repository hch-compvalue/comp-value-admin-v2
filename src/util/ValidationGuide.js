/**
 * 검증 상태 공용 상수 (종목 발굴 안내, 홈 가치점수 카드, 해외 기업가치 화면)
 */
export const PENDING_LABEL = '검증 중';
export const VERIFIED_LABEL = '검증됨';
export const VALUE_ORDER_TITLE = '가치점수 순 — 1개월 보유 시험에서 가장 나았던 순위 (실전 확인 중, 종목 발굴 화면 안내 참고)';

export const BADGE_BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold';
export const PENDING_BADGE = `${BADGE_BASE} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`;
export const VERIFIED_BADGE = `${BADGE_BASE} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300`;

// 국내 검증 결과 — 근거: test/backtest-kr-2026-11 RESULTS.md (2026-11-03, 2024-04~2026-10 주간 135시점, 개발+봉인 1회)
// 적정가 괴리율 12주 순위 예측력: 개발 IC +0.16 · 봉인 +0.11 통과 / 투자 순위 점수 불통과 / 금융은 표본 부족으로 미검증
export const KR_FAIR_VALUE_NOTE = '국내 적정가는 국내 데이터로 검증했습니다 — 적정가보다 싸게 거래되는 종목일수록 12주 뒤 성과가 나은 경향이 두 구간 모두 확인됐습니다. 금융주는 데이터 부족으로 검증하지 못했고, 시장 평균보다 낫다는 보장은 아닙니다.';

// 종목 발굴 사용 규칙 (2026-11-25) — 근거: test/factor-screen-2026-11 (화면 후보 안 상위 30·10, 월 리밸런싱),
// test/rank-model-2026-11 (가치점수 vs 합성 점수 vs AI 시합: 가치점수를 넘는 방식 없음). 이전 연구 데이터 재사용 → '검증 중'
export const PICK_TOP_N = 30;
export const PICK_RULES = [
    `매달 첫 주, 순위 1~${PICK_TOP_N}위 중 10종목 이상을 같은 금액으로 삽니다 (많이 나눌수록 결과가 안정적).`,
    `한 달 뒤 ${PICK_TOP_N}위 밖으로 밀려난 종목만 팔고, ${PICK_TOP_N}위 안의 다른 종목으로 바꿉니다.`,
];
export const KR_PICK_CAUTION = '대형주가 이끄는 장에서는 KOSPI보다 크게 뒤질 수 있어, 투자금 일부는 지수 ETF로 나눠 두세요.';
export const US_PICK_CAUTION = '미국은 효과가 작습니다 — 참고용으로 보고, 투자금 일부는 지수 ETF로 나눠 두세요.';
export const KR_PICK_EVIDENCE = '과거 시험: 이 방식(상위 30)이 전체 종목 평균보다 연 +15%p, 단 같은 기간 KOSPI에는 크게 뒤짐.';
export const US_PICK_EVIDENCE = '과거 시험: 이 방식(상위 30)이 전체 종목 평균보다 연 +4~6%p, 기준(이긴 달 55%)에 경계선.';
