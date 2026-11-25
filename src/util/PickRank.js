import { send } from '@/util/ClientUtil';

/**
 * 종목 발굴 순위 공용 (종목 발굴 표 · 포트폴리오 매수일 칸)
 * 순위 = 그날 후보 전체 안 가치점수 내림차순 (점수 없는 종목은 순위 없음)
 * @param {Array<{symbol:string, valueScore:number|null}>} rows `/dart/main/evaluation/daily` 응답
 * @returns {Map<string, number>} symbol → 순위(1부터)
 */
export function buildValueRankMap(rows = []) {
    const ranked = rows.filter((r) => r.valueScore != null).sort((a, b) => b.valueScore - a.valueScore);
    return new Map(ranked.map((r, i) => [r.symbol, i + 1]));
}

/**
 * 최신 종목 발굴 후보를 불러와 순위표로 반환
 * @returns {Promise<{ranks: Map<string, number>, baseDate: string}|null>} 실패 시 null
 */
export async function fetchValueRanks(market) {
    const { data, error } = await send(`/dart/main/evaluation/daily?market=${market}`, null, 'GET');
    if (error) return null;
    const list = data?.response || [];
    return { ranks: buildValueRankMap(list), baseDate: list[0]?.snapshotDate || '' };
}
