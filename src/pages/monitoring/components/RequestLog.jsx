import { useState, useMemo } from 'react';
import { Panel, Segmented } from './MonitoringUi';

const CLIENT_ERROR = 400;
const SERVER_ERROR = 500;
const SLOW_MS = 1000;
const MS_PER_SEC = 1000;

const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, '0')).join(':');
};

const formatDuration = (ms) => (ms >= MS_PER_SEC ? `${(ms / MS_PER_SEC).toFixed(1)}s` : `${ms}ms`);

// 상태 코드 색 (적록색약 — 2xx sky · 4xx amber · 5xx orange)
const statusClass = (status) => (status >= SERVER_ERROR
    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
    : status >= CLIENT_ERROR
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300');

/** 요청 로그 — 최근 요청(최대 50건), 오류(4xx·5xx)만 걸러 보기 */
export default function RequestLog({ id, apiLogs = [] }) {
    const [filter, setFilter] = useState('all');
    const errors = useMemo(() => apiLogs.filter((l) => l.status >= CLIENT_ERROR), [apiLogs]);
    const rows = filter === 'errors' ? errors : apiLogs;

    const options = [
        { value: 'all', label: '전체' },
        { value: 'errors', label: errors.length ? `오류만 ${errors.length}` : '오류만' },
    ];

    return (
        <Panel id={id} title="요청 로그" subtitle={`최근 ${apiLogs.length}건`} bodyClassName=""
            actions={<Segmented label="로그 필터" options={options} value={filter} onChange={setFilter} />}>
            {rows.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    {filter === 'errors' ? '최근 오류 응답이 없습니다.' : '최근 요청이 없습니다.'}
                </div>
            ) : (
                <div className="max-h-[320px] overflow-y-auto">
                    <table className="w-full table-fixed text-sm">
                        <tbody>
                            {rows.map((l, i) => (
                                <tr key={`${l.timestamp}-${l.uri}-${i}`} className="border-t border-slate-100 first:border-t-0 dark:border-slate-700/60">
                                    <td className="w-20 py-2 pl-4 text-xs text-slate-400 dark:text-slate-500">{formatTime(l.timestamp)}</td>
                                    <td className="w-14 py-2 pl-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{l.method}</td>
                                    <td className="truncate py-2 pl-2 text-slate-700 dark:text-slate-200" title={l.uri}>{l.uri}</td>
                                    <td className="w-14 py-2 pl-2">
                                        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusClass(l.status)}`}>{l.status}</span>
                                    </td>
                                    <td className={`w-16 py-2 pr-4 text-right text-xs ${l.durationMs >= SLOW_MS ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {formatDuration(l.durationMs)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Panel>
    );
}
