/**
 * 자동매매 대시보드 공통 표시 컴포넌트 (코인/주식 탭 공용)
 */
import Button from '@/component/common/button/Button';

export const Card = ({ title, children, right }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            {right}
        </div>
        {children}
    </div>
);

export const Row = ({ label, value, accent }) => (
    <div className="flex justify-between py-1 text-sm">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`font-medium ${accent || 'text-slate-800 dark:text-slate-100'}`}>{value}</span>
    </div>
);

export const WeightBar = ({ weight }) => (
    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-2 bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, (weight || 0) * 100))}%` }} />
    </div>
);

/** 작은 회전 표시 (처리·조회 중) */
export const Spinner = () => (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
);

/** 새로고침 버튼 + 조회 중 표시 */
export const RefreshButton = ({ onClick, busy, refreshing }) => (
    <div className="flex items-center gap-2">
        {refreshing && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Spinner />불러오는 중</span>
        )}
        <Button variant="secondary" size="sm" onClick={onClick} disabled={busy || refreshing}>새로고침</Button>
    </div>
);

/** 모드 선택 버튼 (중지/확인 실행/실전) + 현재 모드 설명 */
export const ModeSelector = ({ modes, current, onChange, disabled, busy }) => (
    <>
        <div className="grid grid-cols-3 gap-2 mb-3">
            {modes.map((m) => (
                <button
                    key={m.key}
                    onClick={() => onChange(m.key)}
                    disabled={disabled}
                    title={m.desc}
                    className={`rounded-lg px-2 py-2 text-sm font-medium border transition-colors ${
                        current === m.key
                            ? m.key === 'LIVE'
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                    {m.label}
                </button>
            ))}
        </div>
        <p className="text-xs text-slate-400 mb-3">
            {busy ? <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><Spinner />변경 중...</span>
                : modes.find((m) => m.key === current)?.desc}
        </p>
    </>
);

/** 오류 목록 배너 */
export const ErrorBanner = ({ errors }) => (errors?.length > 0 ? (
    <div className="rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20 p-3 text-sm text-orange-800 dark:text-orange-200">
        {errors.map((e) => <div key={e}>⚠ {e}</div>)}
    </div>
) : null);
