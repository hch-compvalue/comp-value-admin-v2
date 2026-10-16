// 실행 상태 표시 (적록색약 고려: 성공=하늘, 실패=주황, 실행중=파랑, 중단=노랑)
const STATUS_STYLE = {
    RUNNING: { label: '실행 중', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    SUCCESS: { label: '성공', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
    FAILED: { label: '실패', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    INTERRUPTED: { label: '중단됨', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    SKIPPED: { label: '건너뜀', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

const ScheduleStatusBadge = ({ status }) => {
    const style = STATUS_STYLE[status] || { label: status, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${style.className}`}>
            {status === 'RUNNING' && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
            {style.label}
        </span>
    );
};

export default ScheduleStatusBadge;
