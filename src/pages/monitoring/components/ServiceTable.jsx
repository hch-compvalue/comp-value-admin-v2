import { LEVEL } from '../monitoringModel';
import { StatusDot, UsageBar } from './MonitoringUi';
import { LEVEL_TEXT } from './levelStyles';

const STATUS_LABEL = { [LEVEL.OK]: '정상', [LEVEL.WARN]: '주의', [LEVEL.DOWN]: '중단', [LEVEL.UNKNOWN]: '실행 중' };
const ROW_BG = {
    [LEVEL.DOWN]: 'bg-orange-50/70 dark:bg-orange-950/30',
    [LEVEL.WARN]: 'bg-amber-50/70 dark:bg-amber-950/20',
};

/** 서비스 표 — 상태·가동 시간·CPU·메모리를 서비스당 한 줄로 (문제 있는 행이 위로) */
export default function ServiceTable({ rows }) {
    if (rows.length === 0) {
        return <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">서비스 정보를 불러오는 중입니다.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <th className="w-56 px-4 py-2.5">서비스</th>
                        <th className="w-24 px-4 py-2.5">상태</th>
                        <th className="w-32 px-4 py-2.5">가동 시간</th>
                        <th className="px-4 py-2.5">CPU</th>
                        <th className="px-4 py-2.5">메모리</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.key} className={`border-t border-slate-100 first:border-t-0 dark:border-slate-700/60 ${ROW_BG[r.level] ?? ''}`}>
                            <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900 dark:text-white">{r.label}</div>
                                {r.orig !== r.label && <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{r.orig}</div>}
                            </td>
                            <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 ${LEVEL_TEXT[r.level]} ${r.level === LEVEL.OK ? '' : 'font-semibold'}`}>
                                    <StatusDot level={r.level} />
                                    {STATUS_LABEL[r.level]}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.uptime ?? '—'}</td>
                            <td className="px-4 py-3"><UsageBar usage={r.cpu} /></td>
                            <td className="px-4 py-3"><UsageBar usage={r.mem} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
