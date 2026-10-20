import { LEVEL } from '../monitoringModel';

// 상태 단계별 색 (적록색약 — 정상 sky · 주의 amber · 중단 orange)
export const DOT = {
    [LEVEL.OK]: 'bg-sky-500 dark:bg-sky-400',
    [LEVEL.WARN]: 'bg-amber-500 dark:bg-amber-400',
    [LEVEL.DOWN]: 'bg-orange-500 dark:bg-orange-400',
    [LEVEL.UNKNOWN]: 'bg-slate-400 dark:bg-slate-500',
};
export const LEVEL_TEXT = {
    [LEVEL.OK]: 'text-sky-700 dark:text-sky-300',
    [LEVEL.WARN]: 'text-amber-700 dark:text-amber-300',
    [LEVEL.DOWN]: 'text-orange-700 dark:text-orange-300',
    [LEVEL.UNKNOWN]: 'text-slate-500 dark:text-slate-400',
};
export const BAR = {
    [LEVEL.OK]: 'bg-sky-500 dark:bg-sky-400',
    [LEVEL.WARN]: 'bg-amber-500 dark:bg-amber-400',
    [LEVEL.DOWN]: 'bg-orange-500 dark:bg-orange-400',
};
