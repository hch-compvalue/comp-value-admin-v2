import { FILTER_MODES } from '../constants';
import { CurrencyToggle } from './holdings/CurrencyToggle';

/**
 * 검색 + 필터 + 표시 통화 바
 */
export function SearchFilterBar({ searchText, onSearchChange, filterMode, onFilterModeChange, uniqueSymbols, totalRows, currency, onCurrencyChange, fxAvailable }) {
    const chips = [
        { mode: FILTER_MODES.ALL, label: '전체' },
        { mode: FILTER_MODES.PROFIT, label: '수익' },
        { mode: FILTER_MODES.LOSS, label: '손실' },
    ];

    return (
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* 검색 */}
            <div className="relative flex-1 max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    value={searchText}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="티커 또는 기업명 검색..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                        dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-500
                        dark:focus:ring-blue-500 dark:focus:border-blue-500"
                />
            </div>

            {/* 필터 칩 */}
            <div className="flex items-center gap-1.5">
                {chips.map(({ mode, label }) => (
                    <button
                        key={mode}
                        onClick={() => onFilterModeChange(mode)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            filterMode === mode
                                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-800'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* 통계 + 표시 통화 */}
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 sm:ml-auto">
                <span>
                    종목 <span className="font-semibold text-slate-800 dark:text-slate-100">{uniqueSymbols}</span>개
                    <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
                    매수 <span className="font-semibold text-slate-800 dark:text-slate-100">{totalRows}</span>건
                </span>
                <CurrencyToggle value={currency} onChange={onCurrencyChange} fxAvailable={fxAvailable} />
            </div>
        </div>
    );
}
