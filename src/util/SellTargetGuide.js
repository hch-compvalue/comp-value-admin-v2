/**
 * 목표매도가 안내 문구 공용 상수 (트레이딩 가이드, 거래 등록/수정 모달)
 * 근거: test/backtest-exit-2026-10 PLAN3 — 최신 기업가치로 갱신한 목표가 매도가 매수 시점 고정보다 나음
 */
export const SELL_TARGET_GUIDE = '목표매도가는 최신 기업가치 × 0.95 — 실적 발표로 기업가치가 바뀌면 함께 바뀝니다. 도달 시 매도 검토';
export const SYNC_TITLE = '동기화: 최신 기업가치 × 0.95 목표매도가 자동 적용';
export const SYNC_ON_HINT = '실적 갱신 시 최신 기업가치 기준으로 자동 변경';
export const SYNC_OFF_HINT = '고정 목표가는 실적 변화가 반영되지 않습니다 (동기화 권장)';
