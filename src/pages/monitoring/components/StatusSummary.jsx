import { AlertTriangle } from 'lucide-react';
import { LEVEL } from '../monitoringModel';
import { StatusDot } from './MonitoringUi';
import { LEVEL_TEXT } from './levelStyles';

/**
 * 맨 위 상태 요약 — 문제가 있으면 "주의 필요 N건" 목록, 아래에 영역별 숫자 (누르면 해당 영역으로 이동)
 * @param {{level, tag, title, detail}[]} issues
 * @param {{label, value, sub, level, anchor}[]} kpis
 */
export default function StatusSummary({ issues, kpis, loading }) {
    return (
        <div className="space-y-3">
            {issues.length > 0 && (
                <div role="alert" className="flex flex-wrap items-start gap-x-8 gap-y-3 rounded-xl border border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/40">
                    <div className="flex min-w-[180px] items-center gap-2 text-lg font-bold text-orange-700 dark:text-orange-300">
                        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                        주의 필요 {issues.length}건
                    </div>
                    <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
                        {issues.map((issue, i) => (
                            <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                                <span className={`font-bold ${LEVEL_TEXT[issue.level]}`}>{issue.tag}</span>
                                <span className="text-slate-900 dark:text-white">{issue.title}</span>
                                {issue.detail && <span className="text-xs text-slate-500 dark:text-slate-400">{issue.detail}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {issues.length === 0 && (
                    <div className="col-span-2 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-1 dark:border-slate-700 dark:bg-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400">전체 상태</span>
                        <span className={`flex items-center gap-2 text-xl font-bold ${loading ? 'text-slate-400' : LEVEL_TEXT[LEVEL.OK]}`}>
                            <StatusDot level={loading ? LEVEL.UNKNOWN : LEVEL.OK} className="h-2.5 w-2.5" />
                            {loading ? '확인 중' : '모두 정상'}
                        </span>
                    </div>
                )}
                {kpis.map((k) => (
                    <a
                        key={k.label}
                        href={`#${k.anchor}`}
                        className={`flex flex-col gap-2 rounded-xl border bg-white p-4 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/60 ${
                            k.level === LEVEL.OK ? 'border-slate-200 dark:border-slate-700'
                                : k.level === LEVEL.WARN ? 'border-amber-300 dark:border-amber-700' : 'border-orange-300 dark:border-orange-700'
                        }`}
                    >
                        <span className="text-xs text-slate-500 dark:text-slate-400">{k.label}</span>
                        <span className="flex items-baseline gap-1.5">
                            <span className={`text-xl font-bold ${k.level === LEVEL.OK ? 'text-slate-900 dark:text-white' : LEVEL_TEXT[k.level]}`}>{k.value}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{k.sub}</span>
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
}
