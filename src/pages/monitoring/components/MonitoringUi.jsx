import { LEVEL, WARN_PCT, usageLevel } from '../monitoringModel';
import { DOT, BAR, LEVEL_TEXT } from './levelStyles';

// 막대가 0% 여도 보이도록 최소 폭
const MIN_BAR_PCT = 1;

/** 카드 — 제목·부제·오른쪽 도구 */
export function Panel({ id, title, subtitle, actions, children, className = '', bodyClassName = 'p-4' }) {
    return (
        <section id={id} className={`min-w-0 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 ${className}`}>
            {title && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {title}
                        {subtitle && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{subtitle}</span>}
                    </h2>
                    {actions}
                </div>
            )}
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}

/** 상태 점 — 깜빡임은 문제 상태에만 */
export function StatusDot({ level, className = '' }) {
    const pulse = level === LEVEL.DOWN ? 'animate-pulse' : '';
    return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[level] ?? DOT[LEVEL.UNKNOWN]} ${pulse} ${className}`} />;
}

/** 사용률 막대 + 퍼센트 + 실제 값 */
export function UsageBar({ usage }) {
    if (!usage) return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
    const { pct, text } = usage;
    return (
        <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                {pct != null && (
                    <div className={`h-full rounded-full transition-[width] duration-700 ${BAR[usageLevel(pct)]}`} style={{ width: `${Math.max(pct, MIN_BAR_PCT)}%` }} />
                )}
            </div>
            <span className={`w-10 shrink-0 text-right text-sm font-semibold ${pct != null && pct >= WARN_PCT ? LEVEL_TEXT[usageLevel(pct)] : 'text-slate-900 dark:text-white'}`}>
                {pct != null ? `${pct.toFixed(0)}%` : '—'}
            </span>
            <span className="w-32 shrink-0 truncate text-xs text-slate-500 dark:text-slate-400" title={text}>{text}</span>
        </div>
    );
}

/** 선택 버튼 묶음 (CPU|메모리, 전체|오류만) */
export function Segmented({ label, options, value, onChange }) {
    return (
        <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={`h-8 px-3 text-xs font-medium ${
                        value === o.value
                            ? 'bg-brand text-white'
                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
