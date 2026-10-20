import { useState, useRef, useEffect } from 'react';
import {
    Search,
    Download,
    Columns,
    Calculator,
    Pin,
    Plus,
    Minus,
    FilterX,
    Palette,
    ArrowUpDown,
} from 'lucide-react';
import ColumnVisibilityPanel from './ColumnVisibilityPanel';

function ColorSwatch({ color, size = 14 }) {
    if (color === '__none__') {
        return (
            <span
                className="inline-block rounded border border-slate-300 dark:border-slate-500"
                style={{
                    width: size, height: size,
                    background: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 8px 8px',
                }}
                title="색 없음"
            />
        );
    }
    return (
        <span
            className="inline-block rounded border border-slate-300 dark:border-slate-500"
            style={{ width: size, height: size, backgroundColor: color }}
            title={color}
        />
    );
}

function ColorFilterPanel({
    availableColors,
    colorFilter,
    onToggle,
    onClear,
    onClose,
}) {
    const panelRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div
            ref={panelRef}
            className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    행 색상 필터
                </span>
                <button
                    onClick={() => { onClear(); onClose(); }}
                    className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                >
                    전체 표시
                </button>
            </div>
            <div className="p-2 space-y-1">
                {availableColors.map((color) => {
                    const active = !colorFilter || colorFilter.has(color);
                    return (
                        <label
                            key={color}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            <input
                                type="checkbox"
                                checked={active}
                                onChange={() => onToggle(color)}
                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-500"
                            />
                            <ColorSwatch color={color} />
                            <span className="text-slate-600 dark:text-slate-300">
                                {color === '__none__' ? '색 없음' : color}
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

export default function ExcelToolbar({
    search,
    onSearchChange,
    totalRows,
    filteredCount,
    hasActiveSearch,
    onExportCsv,
    headers,
    hiddenCols,
    onToggleColumn,
    onShowAllColumns,
    onHideAllColumns,
    summaryModeLabel,
    onCycleSummary,
    pinnedCount,
    onAddPin,
    onRemovePin,
    onResetPin,
    maxPin,
    hasAnyFilter,
    onClearAllFilters,
    // 색상
    colorSortDir,
    onToggleColorSort,
    colorFilter,
    onToggleColorFilter,
    onClearColorFilter,
    availableColors,
    hasColorFeatures,
    // 행 선택/삭제
    selectedCount,
    onDeleteSelected,
    onDeselectAll,
}) {
    const [showColumnPanel, setShowColumnPanel] = useState(false);
    const [showColorPanel, setShowColorPanel] = useState(false);

    const colorSortLabel = colorSortDir === 'asc'
        ? '색상순'
        : colorSortDir === 'desc'
            ? '색상역순'
            : '색상정렬';

    return (
        <div className="mb-3 flex flex-wrap items-center gap-2">
            {/* 검색 */}
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="검색..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-sky-400 dark:focus:ring-sky-400"
                />
            </div>

            <span className="text-xs text-slate-500 dark:text-slate-400">
                {filteredCount}건
                {(hasActiveSearch || hasAnyFilter || colorFilter) && ` / ${totalRows}건`}
            </span>

            {/* 행 선택 시 삭제 버튼 */}
            {selectedCount > 0 && (
                <>
                    <div className="h-5 w-px bg-slate-300 dark:bg-slate-600" />
                    <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
                        {selectedCount}건 선택
                    </span>
                    <button
                        onClick={onDeleteSelected}
                        className="flex items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100 dark:border-orange-600 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 whitespace-nowrap"
                        title="선택한 행 삭제"
                    >
                        선택 삭제
                    </button>
                    <button
                        onClick={onDeselectAll}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 whitespace-nowrap"
                        title="선택 해제"
                    >
                        선택 해제
                    </button>
                </>
            )}

            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600" />

            {/* 필터 초기화 */}
            {(hasAnyFilter || colorFilter) && (
                <button
                    onClick={() => { onClearAllFilters(); onClearColorFilter(); }}
                    className="flex items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100 dark:border-orange-600 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 whitespace-nowrap"
                    title="모든 필터 초기화"
                >
                    <FilterX className="h-3.5 w-3.5" />
                    필터 초기화
                </button>
            )}

            {/* 열 고정 */}
            <div className="flex items-center">
                <button
                    onClick={onRemovePin}
                    disabled={pinnedCount === 0}
                    className="rounded-l-lg border border-r-0 border-slate-300 bg-white px-1.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    title="고정 열 줄이기"
                >
                    <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                    onClick={pinnedCount > 0 ? onResetPin : onAddPin}
                    className={`flex items-center gap-1 border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        pinnedCount > 0
                            ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                    title={pinnedCount > 0 ? '열 고정 해제' : '열 고정'}
                >
                    <Pin className="h-3.5 w-3.5" />
                    열 고정
                    {pinnedCount > 0 && (
                        <span className="ml-0.5 rounded-full bg-sky-200 px-1.5 text-[10px] text-sky-800 dark:bg-sky-700 dark:text-sky-200">
                            {pinnedCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={onAddPin}
                    disabled={pinnedCount >= maxPin}
                    className="rounded-r-lg border border-l-0 border-slate-300 bg-white px-1.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    title="고정 열 늘리기"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* 컬럼 표시/숨기기 */}
            <div className="relative">
                <button
                    onClick={() => setShowColumnPanel((v) => !v)}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        hiddenCols.size > 0
                            ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                    title="컬럼 표시/숨기기"
                >
                    <Columns className="h-3.5 w-3.5" />
                    컬럼
                    {hiddenCols.size > 0 && (
                        <span className="ml-0.5 rounded-full bg-sky-200 px-1.5 text-[10px] text-sky-800 dark:bg-sky-700 dark:text-sky-200">
                            -{hiddenCols.size}
                        </span>
                    )}
                </button>
                {showColumnPanel && (
                    <ColumnVisibilityPanel
                        headers={headers}
                        hiddenCols={hiddenCols}
                        onToggle={onToggleColumn}
                        onShowAll={onShowAllColumns}
                        onHideAll={onHideAllColumns}
                        onClose={() => setShowColumnPanel(false)}
                    />
                )}
            </div>

            {/* 색상 정렬 */}
            {hasColorFeatures && (
                <button
                    onClick={onToggleColorSort}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        colorSortDir
                            ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                    title="행 색상 기준 정렬 (클릭: 없음 → 색상순 → 역순)"
                >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {colorSortLabel}
                </button>
            )}

            {/* 색상 필터 */}
            {hasColorFeatures && (
                <div className="relative">
                    <button
                        onClick={() => setShowColorPanel((v) => !v)}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            colorFilter
                                ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50'
                                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                        title="행 색상 필터"
                    >
                        <Palette className="h-3.5 w-3.5" />
                        색상필터
                        {colorFilter && (
                            <span className="ml-0.5 rounded-full bg-sky-200 px-1.5 text-[10px] text-sky-800 dark:bg-sky-700 dark:text-sky-200">
                                {colorFilter.size}
                            </span>
                        )}
                    </button>
                    {showColorPanel && (
                        <ColorFilterPanel
                            availableColors={availableColors}
                            colorFilter={colorFilter}
                            onToggle={onToggleColorFilter}
                            onClear={onClearColorFilter}
                            onClose={() => setShowColorPanel(false)}
                        />
                    )}
                </div>
            )}

            {/* 요약 토글 */}
            <button
                onClick={onCycleSummary}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    summaryModeLabel !== '-'
                        ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
                title="요약 행 모드 전환 (합계/평균/개수/최소/최대)"
            >
                <Calculator className="h-3.5 w-3.5" />
                {summaryModeLabel !== '-' ? summaryModeLabel : '요약'}
            </button>

            {/* CSV 내보내기 */}
            <button
                onClick={onExportCsv}
                className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                title="CSV 내보내기 (현재 필터/정렬 상태)"
            >
                <Download className="h-3.5 w-3.5" />
                CSV
            </button>
        </div>
    );
}
