/**
 * 수동 매매 원칙 공용 상수 (포트폴리오 보유종목 — 경과 개월·기한일, 매매 원칙 안내)
 * 근거: test/backtest-exit-2026-10 PLAN3·PLAN4(목표가 또는 12개월 매도, 두 표본 통과), explore_sector_deadline_2026-10-21(기한 3~12개월 차이 없음, 금융 제외 근거 없음)
 */
export const HOLD_DEADLINE_MONTHS = 12;
/** 기한이 가까워졌다고 표시할 남은 일수 */
export const DEADLINE_SOON_DAYS = 30;

export const TRADING_RULE_TITLE = '수동 매매 원칙 (백테스트 기준)';
export const TRADING_RULE_STEPS = [
    '종목 발굴에서 투자 순위 상위 20% 확인',
    '제외: Financial Services · 현재가가 목표매도가 이상 · 기업가치 0 이하',
    '남은 종목 중 10~20종목을 같은 금액씩 매수',
    `매도: 목표매도가(동기화 ON) 도달 또는 매수 후 ${HOLD_DEADLINE_MONTHS}개월 — 먼저 오는 쪽, 손실 중이어도 기한이면 매도`,
    '매도하면 1~3단계로 빈자리 채우기',
];
export const TRADING_RULE_NOTES = [
    '기대치: 시장 평균 대비 연 1~2%p 초과 수준 · 1종목 12개월 수익 확률 약 58%, 20종목 분산 시 약 73%',
    '기한은 6~12개월 모두 비슷한 결과, 12개월 넘게 들고 있어도 이득 없음',
    '금융 업종 제외는 본인 선택 (데이터상 넣고 빼는 차이 불분명)',
    '성과는 금액이 아니라 같은 기간 ETF 자동매매 수익률과 비교',
];
