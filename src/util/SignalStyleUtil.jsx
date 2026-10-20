/**
 * 투자판정(매수 후보·관심목록·관망) 표시 색상 — 적록색약 친화 팔레트 (초록 대신 파랑)
 * 이모지(🔵🟡⚪)는 OS마다 모양이 달라 색 점(SignalDot)으로 통일
 */
export const SIGNAL_STYLE = {
    '매수 후보': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    '관심목록': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    '관망': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const SIGNAL_DOT_COLOR = {
    '매수 후보': 'bg-blue-500',
    '관심목록': 'bg-amber-400',
    '관망': 'bg-slate-400',
};

/** 판정 색 점 — 판정이 없으면 아무것도 그리지 않음 */
export function SignalDot({ signal, className = '' }) {
    const color = SIGNAL_DOT_COLOR[signal];
    if (!color) return null;
    return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${color} ${className}`} />;
}
