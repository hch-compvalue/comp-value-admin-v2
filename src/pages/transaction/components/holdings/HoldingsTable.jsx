import { TABLE_COLUMNS } from '../../constants';
import { CELL_RENDERERS } from './cells';

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

/** 정렬 상태 아이콘 — 정렬 중인 컬럼만 방향 표시, 나머지는 hover 시 힌트 */
function SortIcon({ direction }) {
    if (!direction) {
        return (
            <svg className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
        );
    }
    return (
        <svg className={`h-3 w-3 ${direction === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
    );
}

function HeaderCell({ col, index, sortConfig, onSort }) {
    const active = col.sortKey != null && sortConfig.column === col.sortKey;
    const direction = active ? sortConfig.direction : null;
    return (
        <th
            scope="col"
            aria-sort={col.sortKey == null ? undefined : direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
            className={`sticky top-0 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 ${index === 0 ? 'left-0 z-30' : 'z-20'} ${ALIGN[col.align]}`}
        >
            {col.sortKey == null ? col.label : (
                <button
                    type="button"
                    onClick={() => onSort(col.sortKey)}
                    className={`group/sort inline-flex items-center gap-1 rounded hover:text-slate-800 dark:hover:text-slate-200 ${col.align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-slate-900 dark:text-slate-100' : ''}`}
                >
                    {col.label}
                    <SortIcon direction={direction} />
                </button>
            )}
        </th>
    );
}

function HoldingRow({ model, ctx, onRowClick }) {
    const bg = model.isHit ? 'bg-row-hit' : model.kind === 'lot' ? 'bg-row-nested' : 'bg-row-base';
    const text = model.kind === 'lot' ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-slate-100';
    return (
        <tr onClick={() => onRowClick(model)} className={`group cursor-pointer transition-colors ${bg} ${text} hover:bg-row-hover`} title="클릭하여 상세정보 보기">
            {TABLE_COLUMNS.map((col, i) => (
                <td
                    key={col.key}
                    className={`border-b border-slate-100 px-4 py-3 align-middle dark:border-slate-700/60 ${ALIGN[col.align]} ${
                        i === 0 ? `sticky left-0 z-10 bg-inherit ${model.isHit ? 'shadow-[inset_3px_0_0_var(--color-amber-400)]' : ''}` : ''
                    }`}
                >
                    {CELL_RENDERERS[col.key](model, ctx)}
                </td>
            ))}
        </tr>
    );
}

function MessageRow({ children }) {
    return (
        <tr>
            <td colSpan={TABLE_COLUMNS.length} className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                {children}
            </td>
        </tr>
    );
}

/**
 * 보유종목 테이블
 * @param displayRows  utils/holdingModel.toDisplayRows 결과
 * @param ctx          셀 렌더러 공용 값 { currency, fx, expandedSymbols, onToggleGroup }
 * @param emptyMessage 행이 없을 때 안내 (null 이면 표시 안 함)
 */
export function HoldingsTable({ displayRows, ctx, sortConfig, onSort, onRowClick, emptyMessage }) {
    return (
        <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full table-fixed border-separate border-spacing-0 whitespace-nowrap text-sm tabular-nums [&_tbody_tr:last-child_td]:border-b-0">
                <colgroup>
                    {TABLE_COLUMNS.map((col) => <col key={col.key} className={col.width} />)}
                </colgroup>
                <thead>
                    <tr>
                        {TABLE_COLUMNS.map((col, i) => (
                            <HeaderCell key={col.key} col={col} index={i} sortConfig={sortConfig} onSort={onSort} />
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {displayRows.length === 0 && emptyMessage && <MessageRow>{emptyMessage}</MessageRow>}
                    {displayRows.map((m) => <HoldingRow key={m.key} model={m} ctx={ctx} onRowClick={onRowClick} />)}
                </tbody>
            </table>
        </div>
    );
}
