/**
 * 외부 API 상태 카드
 * - UP/DOWN 상태 + 응답시간(ms) 표시
 * - uptime 필드에 응답시간이 "123ms" 형태로 들어옴
 */
export default function ExternalApiStatusCard({ api }) {
    if (!api) return null;

    const isUp = api.status === 'UP';
    const responseTime = api.uptime || '-';

    // 응답시간 숫자 추출 (색상 판단용)
    const ms = parseInt(responseTime) || 0;
    const speedColor = ms === 0
        ? 'text-slate-400'
        : ms < 500
            ? 'text-sky-600 dark:text-sky-400'
            : ms < 2000
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-orange-600 dark:text-orange-400';

    return (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 shadow-sm">
            {/* 상단: API 이름 + 상태 */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{api.name}</span>
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${
                    isUp
                        ? 'text-sky-600 dark:text-sky-400'
                        : 'text-orange-600 dark:text-orange-400'
                }`}>
                    <span className={`h-2 w-2 rounded-full ${
                        isUp ? 'bg-sky-500 dark:bg-sky-400 animate-pulse' : 'bg-orange-500 dark:bg-orange-400'
                    }`} />
                    {isUp ? 'Online' : 'Offline'}
                </span>
            </div>

            {/* 하단: 응답시간 */}
            <div className="text-xs text-slate-500">
                Response: <span className={`font-mono font-semibold ${speedColor}`}>{responseTime}</span>
            </div>

            {/* API Key 없음 표시 */}
            {api.version === 'No API Key' && (
                <div className="mt-1 text-xs text-amber-500">API Key not configured</div>
            )}
        </div>
    );
}
