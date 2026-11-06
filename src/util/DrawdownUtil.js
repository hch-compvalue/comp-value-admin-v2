/**
 * 52주 고점 대비 하락률 — 시장(기준 지수)과 비교한 경고 판단 (상세 모달 배너, 일괄 평가 표)
 * 하락장에서는 고정 기준(−20%/−30%)이 거의 모든 종목에 걸려 구분이 안 돼서, 백엔드가 주는
 * 지수 대비 상대 하락률 relativeHigh52wDropPercent = (1+종목)/(1+지수) − 1 로 판단한다.
 * 지수가 고점 근처면 상대 하락률 ≈ 종목 하락률이라 기존과 같게 동작. 상대값이 없으면(옛 응답·지수 조회 실패) 종목 하락률로 판단.
 * 점수 계산(백엔드 Step6 감점)은 그대로 — 표시만 바뀜.
 */
export const DROP_WARN_PCT = -20;
export const DROP_SEVERE_PCT = -30;

const toNum = (v) => (v == null ? NaN : parseFloat(String(v).replace('%', '')));

export const fmtSignedPct = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

/** @returns {{drop:number, bench:number|null, rel:number|null, name:string|null, level:'severe'|'warn'|'none'}|null} */
export function drawdownInfo(row) {
    const drop = toNum(row?.high52wDropPercent);
    if (isNaN(drop)) return null;
    const rel = toNum(row?.relativeHigh52wDropPercent);
    const bench = toNum(row?.benchmarkHigh52wDropPercent);
    const hasBench = !isNaN(rel) && !isNaN(bench);
    const basis = hasBench ? rel : drop;
    const level = basis <= DROP_SEVERE_PCT ? 'severe' : basis <= DROP_WARN_PCT ? 'warn' : 'none';
    return { drop, bench: hasBench ? bench : null, rel: hasBench ? rel : null, name: hasBench ? row.benchmarkName : null, level };
}

/** "같은 기간 KOSPI −36.0% → 시장보다 15.6% 더 하락" (지수 값 없으면 빈 문자열) */
export function marketCompareText(info) {
    if (!info || info.rel == null) return '';
    return `같은 기간 ${info.name} ${fmtSignedPct(info.bench)} → 시장보다 ${Math.abs(info.rel).toFixed(1)}% ${info.rel < 0 ? '더' : '덜'} 하락`;
}
