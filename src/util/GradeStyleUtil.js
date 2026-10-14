/**
 * 가치등급(S~F) 표시 색상 — 적록색약 친화 팔레트 (빨강↔초록 대비 금지)
 * 좋음 → 나쁨: indigo · blue · sky · amber · orange · 진한 orange
 */
export const GRADE_STYLE = {
    S: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    A: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    B: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
    C: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    D: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    F: 'bg-orange-300 text-orange-950 dark:bg-orange-700 dark:text-orange-50',
};

export const GRADE_STYLE_DEFAULT = 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';

/** 엑셀 내보내기 행 배경 (GRADE_STYLE 과 같은 계열의 100/300 톤, ARGB) */
export const GRADE_EXCEL_ARGB = {
    S: 'FFE0E7FF', // indigo-100
    A: 'FFDBEAFE', // blue-100
    B: 'FFE0F2FE', // sky-100
    C: 'FFFEF3C7', // amber-100
    D: 'FFFFEDD5', // orange-100
    F: 'FFFDBA74', // orange-300
};
