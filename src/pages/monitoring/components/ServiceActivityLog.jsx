import { useRef, useEffect } from 'react';
import TruncatedText from './TruncatedText';

/**
 * Service Activity 로그 — API 요청 로그 실시간 표시
 * 최근 20건만 한 줄씩 표시
 * 상태코드 색상: 2xx=sky, 4xx=amber, 5xx=orange (적록색약 — 빨강/초록 미사용)
 */
export default function ServiceActivityLog({ apiLogs = [] }) {
    const containerRef = useRef(null);
    const recent = apiLogs.slice(0, 20);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, [apiLogs.length]);

    if (recent.length === 0) {
        return (
            <div className="flex items-center justify-center h-20 text-slate-400 dark:text-slate-600 text-xs">
                No recent activity
            </div>
        );
    }

    return (
        <div ref={containerRef} className="max-h-48 overflow-y-auto pr-1 scrollbar-thin space-y-0.5">
            {recent.map((log, i) => (
                <ActivityRow key={`${log.timestamp}-${log.uri}-${i}`} log={log} isNew={i === 0} />
            ))}
        </div>
    );
}

function ActivityRow({ log, isNew }) {
    const animation = isNew ? 'animate__animated animate__fadeIn' : '';

    const statusColor = log.status >= 500
        ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
        : log.status >= 400
            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
            : 'bg-sky-500/20 text-sky-600 dark:text-sky-400';

    const methodColor = {
        GET: 'text-sky-600 dark:text-sky-400',
        POST: 'text-violet-600 dark:text-violet-400',
        PUT: 'text-amber-600 dark:text-amber-400',
        DELETE: 'text-orange-600 dark:text-orange-400',
    }[log.method] || 'text-slate-500 dark:text-slate-400';

    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    };

    return (
        <div
            className={`${animation} flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors`}
            style={isNew ? { animationDuration: '0.4s' } : undefined}
        >
            <span className="text-slate-400 dark:text-slate-600 font-mono shrink-0">
                [{formatTime(log.timestamp)}]
            </span>
            <span className={`font-bold font-mono w-10 shrink-0 ${methodColor}`}>
                {log.method}
            </span>
            <TruncatedText className="text-slate-700 dark:text-slate-300 font-mono min-w-0">
                {log.uri}
            </TruncatedText>
            <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 font-bold shrink-0 ${statusColor}`}>
                {log.status}
            </span>
            <span className="text-slate-400 dark:text-slate-500 font-mono shrink-0">
                {log.durationMs}ms
            </span>
        </div>
    );
}
