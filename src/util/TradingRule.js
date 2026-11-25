import { PICK_TOP_N, PICK_RULES, KR_PICK_CAUTION, US_PICK_CAUTION, KR_PICK_EVIDENCE, US_PICK_EVIDENCE } from '@/util/ValidationGuide';

/**
 * 수동 매매 원칙 공용 상수 (포트폴리오 보유종목 — 경과 개월·점검일·순위, 매매 원칙 안내)
 * 종목 발굴 사용 규칙(ValidationGuide PICK_*, 2026-11-25)과 같은 기준 — 문구는 그쪽을 그대로 씀
 * 근거: test/factor-screen-2026-11 (후보 안 가치점수 상위 30 · 월 교체), test/rank-model-2026-11
 * (이전 12개월 기한·목표가 매도 원칙 근거 test/backtest-exit-2026-10 는 월 교체 방식으로 대체)
 */
/** 매수 후 이 간격(개월)마다 순위 점검 */
export const CHECK_INTERVAL_MONTHS = 1;
/** 점검일이 가까워졌다고 표시할 남은 일수 */
export const CHECK_SOON_DAYS = 7;

export const TRADING_RULE_TITLE = '수동 매매 원칙 (종목 발굴 기준)';
export const TRADING_RULE_STEPS = [
    ...PICK_RULES,
    `표의 매수일 칸에서 점검일과 현재 순위 확인 — 매수 후 ${CHECK_INTERVAL_MONTHS}개월이 지나 ${PICK_TOP_N}위 밖(후보에서 빠진 종목 포함)이면 '교체 대상'으로 표시됩니다.`,
];

/** 시장별 참고 문구 */
export function tradingRuleNotes(isKr) {
    return [
        isKr ? KR_PICK_EVIDENCE : US_PICK_EVIDENCE,
        isKr ? KR_PICK_CAUTION : US_PICK_CAUTION,
        '목표매도가 도달·보유 기간으로는 팔지 않습니다 — 교체는 순위로만 판단 (목표가는 참고 표시)',
        `성과는 금액이 아니라 같은 기간 ${isKr ? 'KOSPI' : 'S&P 500'} 지수와 비교`,
    ];
}
