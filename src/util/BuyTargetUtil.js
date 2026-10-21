/**
 * 매수 대상 거름망 (종목 발굴 '매수 대상' 목록, 홈 매수 대상 카드)
 * 근거: test/backtest-exit-2026-10 explore_grade_split·rank_quint (2026-10-21, 두 표본 일치, 사전등록 아님)
 *  - 투자 순위 상위 20% + 가치등급 B 이상 + 목표매도가 미도달: 12개월 시장 평균 대비 +2.7~3.1%p
 *  - 거름망 통과 종목 안의 순위 차이는 작음 (IC +0.02) → 순서보다 목록·분산이 중요
 */
export const BUY_TARGET_LABEL = '매수 대상';
export const FINANCIAL_SECTOR = 'Financial Services';
/** 투자 순위 상위 비율 (후보 전체 기준) */
export const TOP_RANK_RATIO = 0.2;
/** 가치등급 B 하한 — 백엔드 StockEvaluationService.calculateGrade 와 같은 값 */
export const MIN_VALUE_SCORE = 73;
/** 목표매도가 = 주당가치 × 0.95 — 백엔드 PerShareValueCalcHelper.calculateSellTarget 와 같은 값 */
export const SELL_TARGET_RATIO = 0.95;

export const BUY_TARGET_NOTE = `${BUY_TARGET_LABEL} = 투자 순위 상위 ${TOP_RANK_RATIO * 100}% · 가치등급 B 이상 · 현재가 < 목표매도가. 목록 안 순서 차이는 작아서, 10~20종목을 같은 금액씩 나눠 담는 것이 핵심입니다 (백테스트 12개월 시장 평균 대비 약 +3%p, 탐색값)`;

/** 후보 전체에서 투자 순위 상위 20% 심볼 (순위 점수 없는 종목 제외) */
export function topRankSymbols(rows) {
    const ranked = rows.filter((r) => r.rankScore != null).sort((a, b) => b.rankScore - a.rankScore);
    return new Set(ranked.slice(0, Math.round(ranked.length * TOP_RANK_RATIO)).map((r) => r.symbol));
}

/**
 * 매수 대상에서 빠지는 이유 (빈 배열 = 매수 대상)
 * @param {Set<string>} topSet topRankSymbols 결과
 */
export function buyExcludeReasons(row, topSet, excludeFinancial) {
    const reasons = [];
    const fair = Number(row.fairValue);
    const price = Number(row.currentPrice);
    if (!topSet.has(row.symbol)) reasons.push(`순위 ${TOP_RANK_RATIO * 100}% 밖`);
    if (!(Number(row.valueScore) >= MIN_VALUE_SCORE)) reasons.push('가치 C 이하');
    if (!(fair > 0)) reasons.push('기업가치 없음');
    else if (!(price > 0 && price < fair * SELL_TARGET_RATIO)) reasons.push('목표가 도달');
    if (excludeFinancial && row.sector === FINANCIAL_SECTOR) reasons.push('금융');
    return reasons;
}

/** 매수 대상만 투자 순위 내림차순으로 */
export function selectBuyTargets(rows, excludeFinancial) {
    const topSet = topRankSymbols(rows);
    return rows
        .filter((r) => buyExcludeReasons(r, topSet, excludeFinancial).length === 0)
        .sort((a, b) => b.rankScore - a.rankScore);
}
