import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const NULL_KEY = '__NULL__';
const toKey = (v) => (v === null || v === undefined ? NULL_KEY : String(v));

/**
 * 엑셀 스타일 컬럼 필터 드롭다운
 * - 헤더 아이콘 클릭 시 팝오버 오픈
 * - 정렬(오름/내림), 검색창, 고유값 체크박스 목록
 * - 전체 선택/해제, 확인/필터 해제
 */
export default function ExcelFilter({
    allValues = [],
    selectedValues,          // string[] | undefined (undefined = 필터 없음)
    onApply,                 // (values: string[] | undefined) => void
    onSort,                  // (direction: 'asc' | 'desc') => void
    sortDirection,           // 'asc' | 'desc' | null
    getOptionLabel,          // (raw) => string
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [localSelected, setLocalSelected] = useState(() => new Set());
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const popoverRef = useRef(null);

    const uniqueValues = useMemo(() => {
        const seen = new Map();
        allValues.forEach((v) => {
            const k = toKey(v);
            if (!seen.has(k)) seen.set(k, v);
        });
        return Array.from(seen.values()).sort((a, b) => {
            if (a == null) return 1;
            if (b == null) return -1;
            if (typeof a === 'number' && typeof b === 'number') return a - b;
            return String(a).localeCompare(String(b));
        });
    }, [allValues]);

    const uniqueKeys = useMemo(() => uniqueValues.map(toKey), [uniqueValues]);

    // 팝오버 열 때마다 로컬 상태 초기화
    useEffect(() => {
        if (!isOpen) return;
        const initial = selectedValues === undefined
            ? new Set(uniqueKeys)
            : new Set(selectedValues.map(toKey));
        setLocalSelected(initial);
        setSearch('');
    }, [isOpen, selectedValues, uniqueKeys]);

    const openPopover = useCallback(() => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const POPOVER_WIDTH = 256;
            const viewportWidth = window.innerWidth;
            let left = rect.left;
            if (left + POPOVER_WIDTH > viewportWidth - 8) {
                left = Math.max(8, viewportWidth - POPOVER_WIDTH - 8);
            }
            setPosition({ top: rect.bottom + 4, left });
        }
        setIsOpen(true);
    }, []);

    // 외부 클릭 / ESC / 스크롤 닫기
    useEffect(() => {
        if (!isOpen) return;
        const handleMouseDown = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (btnRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        const handleScroll = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };
        const handleResize = () => setIsOpen(false);
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKey);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKey);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen]);

    const labelOf = useCallback((v) => {
        if (getOptionLabel) return getOptionLabel(v);
        if (v === null || v === undefined || v === '') return '(비어있음)';
        return String(v);
    }, [getOptionLabel]);

    const filteredOptions = useMemo(() => {
        if (!search) return uniqueValues;
        const s = search.toLowerCase();
        return uniqueValues.filter((v) => {
            const label = labelOf(v);
            if (String(label).toLowerCase().includes(s)) return true;
            if (v != null && String(v).toLowerCase().includes(s)) return true;
            return false;
        });
    }, [uniqueValues, search, labelOf]);

    const allVisibleSelected = filteredOptions.length > 0
        && filteredOptions.every((v) => localSelected.has(toKey(v)));

    const toggleValue = (v) => {
        const k = toKey(v);
        setLocalSelected((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    };

    const toggleAllVisible = () => {
        setLocalSelected((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) {
                filteredOptions.forEach((v) => next.delete(toKey(v)));
            } else {
                filteredOptions.forEach((v) => next.add(toKey(v)));
            }
            return next;
        });
    };

    const handleApply = () => {
        // 전체가 선택된 경우 필터 해제
        if (localSelected.size === uniqueKeys.length) {
            onApply(undefined);
        } else {
            const selectedRawValues = uniqueValues
                .filter((v) => localSelected.has(toKey(v)))
                .map((v) => (v === null || v === undefined ? null : String(v)));
            onApply(selectedRawValues);
        }
        setIsOpen(false);
    };

    const handleClearFilter = () => {
        onApply(undefined);
        setIsOpen(false);
    };

    const handleSortClick = (direction) => {
        if (onSort) onSort(direction);
        setIsOpen(false);
    };

    const isFiltered = selectedValues !== undefined;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (isOpen) setIsOpen(false);
                    else openPopover();
                }}
                className={`ml-1 w-5 h-5 inline-flex items-center justify-center rounded transition-colors ${isFiltered
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900'
                    : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                    }`}
                title={isFiltered ? '필터 적용됨 (클릭하여 편집)' : '필터'}
                aria-label="필터"
            >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M3 5h18l-7 9v5l-4 2v-7L3 5z" />
                </svg>
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className="fixed z-[60] w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl overflow-hidden"
                    style={{ top: position.top, left: position.left }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 정렬 */}
                    <div className="px-2 py-1 border-b border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            className="w-full px-2 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center gap-2"
                            onClick={() => handleSortClick('asc')}
                        >
                            <span className="text-blue-500">▲</span>
                            <span>오름차순 정렬</span>
                            {sortDirection === 'asc' && <span className="ml-auto text-blue-500">●</span>}
                        </button>
                        <button
                            type="button"
                            className="w-full px-2 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded flex items-center gap-2"
                            onClick={() => handleSortClick('desc')}
                        >
                            <span className="text-blue-500">▼</span>
                            <span>내림차순 정렬</span>
                            {sortDirection === 'desc' && <span className="ml-auto text-blue-500">●</span>}
                        </button>
                    </div>

                    {/* 검색 */}
                    <div className="px-3 py-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="검색..."
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* 전체 선택 */}
                    <div className="px-2 border-b border-slate-200 dark:border-slate-700 pb-1">
                        <label className="flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleAllVisible}
                                className="w-3.5 h-3.5"
                            />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                (전체 선택{search ? ' — 검색 결과' : ''})
                            </span>
                        </label>
                    </div>

                    {/* 값 목록 */}
                    <div className="max-h-60 overflow-y-auto px-2 py-1">
                        {filteredOptions.length === 0 ? (
                            <div className="text-xs text-slate-400 px-2 py-4 text-center">검색 결과 없음</div>
                        ) : (
                            filteredOptions.map((v, i) => {
                                const k = toKey(v);
                                const label = labelOf(v);
                                return (
                                    <label
                                        key={`${k}-${i}`}
                                        className="flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={localSelected.has(k)}
                                            onChange={() => toggleValue(v)}
                                            className="w-3.5 h-3.5 flex-shrink-0"
                                        />
                                        <span className="text-xs text-slate-700 dark:text-slate-200 truncate" title={label}>
                                            {label}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>

                    {/* 푸터 */}
                    <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                        <button
                            type="button"
                            onClick={handleApply}
                            className="flex-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                        >
                            확인
                        </button>
                        <button
                            type="button"
                            onClick={handleClearFilter}
                            disabled={!isFiltered}
                            className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            해제
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
