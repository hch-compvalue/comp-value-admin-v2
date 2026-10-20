import TruncatedText from './TruncatedText';

/**
 * 서비스 건강 상태 카드
 */
export default function ServiceStatusCard({ service }) {
    if (!service) return null;

    const statusConfig = {
        UP: { color: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500 dark:bg-sky-400', label: 'Online' },
        DOWN: { color: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500 dark:bg-orange-400', label: 'Offline' },
        DEGRADED: { color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500 dark:bg-amber-400', label: 'Degraded' },
    };

    const cfg = statusConfig[service.status] || statusConfig.DOWN;

    return (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <TruncatedText className="text-sm font-medium text-slate-700 dark:text-slate-300">{service.name}</TruncatedText>
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
                    <span className={`h-2 w-2 rounded-full ${cfg.dot} animate-pulse`} />
                    {cfg.label}
                </span>
            </div>
            {service.uptime && (
                <div className="text-xs text-slate-500">
                    Uptime: <span className="text-slate-600 dark:text-slate-400">{service.uptime}</span>
                </div>
            )}
            {service.version && (
                <div className="text-xs text-slate-500">
                    Version: <span className="text-slate-600 dark:text-slate-400">{service.version}</span>
                </div>
            )}
        </div>
    );
}
