import { toNum } from './formatters';
import { calcHoldPeriod, earliestBuyDate } from './holdPeriod';

/** 전일 대비 보합으로 볼 등락률 절대값(%) */
const DAY_CHANGE_FLAT_PCT = 0.005;

/**
 * 목표가 진행률(%) — 매수가→목표가 구간에서 현재가 위치
 * @returns {number|null} 목표가가 없거나 매수가 이하이면 null
 */
export function calcTargetProgress(buy, cur, target) {
    if (!(target > 0 && buy > 0 && target > buy)) return null;
    return ((cur - buy) / (target - buy)) * 100;
}

/**
 * 전일 대비 등락률(%) — 보합 구간은 0
 * @returns {number|null} 전일 종가/현재가 없으면 null
 */
export function calcDayChangePct(cur, prevClose) {
    if (!(prevClose > 0 && cur > 0)) return null;
    const pct = ((cur - prevClose) / prevClose) * 100;
    return Math.abs(pct) < DAY_CHANGE_FLAT_PCT ? 0 : pct;
}

/**
 * 행 표시 모델 — 개별 매수 건과 종목 합계를 같은 셀 렌더러로 그리기 위한 공통 형태
 * kind: 'single'(단일 매수) | 'group'(종목 합계) | 'lot'(그룹 안 개별 매수)
 */
function buildModel({ kind, key, symbol, companyName, qty, buyPrice, curPrice, prevClose, buyAmount, evalAmount, targetPrice, buyDate, holdFrom = buyDate, rmk, source, lotCount = 0, lotIndex = 0 }) {
    const pnl = evalAmount - buyAmount;
    return {
        kind, key, symbol, companyName, qty, buyPrice, curPrice, buyAmount, evalAmount, targetPrice, buyDate, rmk, source, lotCount, lotIndex,
        pnl,
        pnlPct: buyAmount > 0 ? (pnl / buyAmount) * 100 : 0,
        dayChangePct: calcDayChangePct(curPrice, prevClose),
        targetProgress: calcTargetProgress(buyPrice, curPrice, targetPrice),
        isHit: targetPrice > 0 && curPrice >= targetPrice,
        holdFrom,
        hold: calcHoldPeriod(holdFrom),
    };
}

/** 거래 행(백엔드 1건) → 표시 모델 */
export function lotToModel(row, kind = 'single', lotIndex = 0) {
    const qty = toNum(row.totalBuyAmount);
    const buyPrice = toNum(row.buyPrice);
    const curPrice = toNum(row.currentPrice);
    return buildModel({
        kind,
        key: `r-${row.id}`,
        symbol: row.symbol,
        companyName: row.companyName,
        qty,
        buyPrice,
        curPrice,
        prevClose: toNum(row.previousClose),
        buyAmount: buyPrice * qty,
        evalAmount: curPrice * qty,
        targetPrice: toNum(row.targetPrice),
        buyDate: row.buyDate,
        rmk: row.rmk,
        source: row,
        lotIndex,
    });
}

/** groupRowsBySymbol 의 합계 행 → 표시 모델 (평균 매수가·합계 금액 기준) */
export function groupToModel(group) {
    return buildModel({
        kind: 'group',
        key: `g-${group.symbol}`,
        symbol: group.symbol,
        companyName: group.companyName,
        qty: group.qtySum,
        buyPrice: group.buyAvgUSD,
        curPrice: group.curUSD,
        prevClose: group.prevCloseUSD,
        buyAmount: group.buySumUSD,
        evalAmount: group.curSumUSD,
        targetPrice: group.targetAvgUSD,
        buyDate: '',
        holdFrom: earliestBuyDate(group.groupRows),   // 합계 행 기한 = 가장 먼저 산 건 기준
        rmk: '',
        source: group,
        lotCount: group.groupRows.length,
    });
}

/** 그룹 안 개별 매수 → 표시 모델 (lotIndex: 매수일 순서 1차·2차…, 표시 순서는 정렬 결과 유지) */
function lotsToModels(rawLots) {
    const byDate = [...rawLots].sort((a, b) => String(a.buyDate || '').localeCompare(String(b.buyDate || '')));
    return rawLots.map((r) => lotToModel(r, 'lot', byDate.indexOf(r) + 1));
}

/**
 * groupRowsBySymbol 결과 → 화면 표시 행 목록
 * - 단일 매수: single
 * - 같은 종목 여러 건: 합계(group)를 먼저, 펼친 종목만 개별 매수(lot)를 그 아래에
 * @param {Array} groupedRows - groupRowsBySymbol 반환값 (구분선·개별 행·합계 행 순)
 * @param {Set<string>} expandedSymbols - 펼친 종목 심볼(대문자)
 */
export function toDisplayRows(groupedRows, expandedSymbols) {
    const out = [];
    let rawLots = [];
    for (const r of groupedRows) {
        if (r.__type === 'groupStartDivider') continue;
        if (r.__type === 'groupTotal') {
            out.push(groupToModel(r));
            if (expandedSymbols.has(r.symbol)) out.push(...lotsToModels(rawLots));
            rawLots = [];
        } else if (r.__groupKey) {
            rawLots.push(r);
        } else {
            out.push(lotToModel(r));
        }
    }
    return out;
}
