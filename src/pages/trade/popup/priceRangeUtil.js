/** 한 달 예상 움직임 공용 상수·포맷 (PriceRangeBlock, InvestmentDetailModal) */
export const RANGE_TITLE = '한 달 예상 움직임';
export const RANGE_SOURCE_NOTE = '과거 미국 1,494종목(2018~2026) 통계';
export const PCT = 100;
export const hasPriceRange = (et) => !!et && et.rangeLow > 0 && et.rangeHigh > et.rangeLow;
export const fmtProb = (p) => (p == null || isNaN(p) ? '-' : `${Math.round(p * PCT)}%`);
export const fmtUsd2 = (v) => (v == null || isNaN(v) ? '-' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
