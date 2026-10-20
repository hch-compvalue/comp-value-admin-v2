import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { Check, Calendar, User, Image, Paperclip } from 'lucide-react';

const CustomTable = forwardRef(({ columns = [], rowData = [], loading = false, moveViewPage }, ref) => {
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [allSelected, setAllSelected] = useState(false);
    // 1024px 이하에서 카드 뷰로 전환 (태블릿 포함)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        setSelectedRows(new Set());
        setAllSelected(false);
    }, [rowData]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useImperativeHandle(ref, () => ({
        api: {
            getSelectedRows: () => {
                return rowData.filter(row => selectedRows.has(row.id));
            }
        }
    }));

    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedRows(new Set());
            setAllSelected(false);
        } else {
            const allIds = new Set(rowData.map(row => row.id));
            setSelectedRows(allIds);
            setAllSelected(true);
        }
    };

    const handleSelectRow = (id) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
        setAllSelected(newSelected.size === rowData.length && rowData.length > 0);
    };

    const handleRowClick = (row, field) => {
        if (field === 'checkbox') return;
        if (moveViewPage) {
            moveViewPage({ data: row });
        }
    };

    const visibleColumns = columns.filter(col => !col.hide);
    const hasCheckboxSelection = visibleColumns.some(col => col.checkboxSelection || col.headerCheckboxSelection);

    // 모바일 카드 뷰 렌더링
    const renderMobileView = () => {
        return (
            <div className="space-y-3">
                {rowData.map((row, rowIndex) => {
                    const isSelected = selectedRows.has(row.id);
                    const isNotice = row.notice;
                    return (
                        <div
                            key={row.id || rowIndex}
                            className={`rounded-lg border-2 transition-all ${
                                isNotice
                                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-300'
                                    : isSelected
                                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-600'
                                    : 'border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                        >
                            {/* 헤더: 체크박스와 번호 */}
                            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700">
                                {hasCheckboxSelection ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelectRow(row.id);
                                        }}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                            isSelected
                                                ? 'bg-sky-500 border-sky-500 dark:bg-sky-600 dark:border-sky-600'
                                                : 'border-slate-300 dark:border-slate-600 hover:border-sky-400 dark:hover:border-sky-500'
                                        }`}
                                    >
                                        {isSelected && <Check size={14} className="text-white" />}
                                    </button>
                                ) : (
                                    <div></div>
                                )}
                                {isNotice ? (
                                    <div className="flex items-center gap-1">
                                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path>
                                        </svg>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">공지</span>
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-500 dark:text-slate-400">#{row.id}</span>
                                )}
                            </div>

                            {/* 콘텐츠 영역 - 전체 클릭 가능 */}
                            <div
                                onClick={() => handleRowClick(row, 'title')}
                                className="cursor-pointer p-4 space-y-3"
                            >
                                {/* 제목 */}
                                <h3 className="font-medium text-slate-900 dark:text-white line-clamp-2 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-start gap-1">
                                    {isNotice && (
                                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path>
                                        </svg>
                                    )}
                                    {row.secret && (
                                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                                        </svg>
                                    )}
                                    <span className="flex-1">{row.title}</span>
                                    {row.commentCount > 0 && (
                                        <span className="text-xs text-blue-500 dark:text-blue-400 font-medium flex-shrink-0">
                                            [{row.commentCount}]
                                        </span>
                                    )}
                                    {/<img\s/i.test(row.content || '') && (
                                        <Image size={16} className="mt-0.5 flex-shrink-0 text-sky-500 dark:text-sky-400" />
                                    )}
                                    {(row.attachments?.length > 0) && (
                                        <Paperclip size={16} className="mt-0.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                                    )}
                                </h3>

                                {/* 작성자 및 날짜 */}
                                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <User size={14} className="flex-shrink-0" />
                                        <span className="truncate text-xs">{row.author}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                        <Calendar size={14} className="flex-shrink-0" />
                                        <span className="text-xs whitespace-nowrap">
                                            {new Date(row.createdAt).toLocaleDateString('ko-KR', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="overflow-hidden">
            {/* 데이터 카운트 */}
            <div className="flex justify-between items-center mb-3 px-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                    전체 <span className="font-semibold text-slate-900 dark:text-white">{rowData.length}</span>건
                    {selectedRows.size > 0 && (
                        <span className="ml-2 text-sky-600 dark:text-sky-400">
                            ({selectedRows.size}건 선택됨)
                        </span>
                    )}
                </span>
                {/* 모바일에서 전체 선택 버튼 */}
                {isMobile && rowData.length > 0 && hasCheckboxSelection && (
                    <button
                        onClick={handleSelectAll}
                        className="text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium"
                    >
                        {allSelected ? '전체 해제' : '전체 선택'}
                    </button>
                )}
            </div>

            {/* 로딩 및 빈 데이터 상태 */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <svg className="animate-spin h-10 w-10 mb-4 text-sky-500 dark:text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <p className="text-sm font-medium">로딩 중입니다...</p>
                </div>
            ) : rowData.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-sm font-medium">표시할 데이터가 없습니다.</p>
                </div>
            ) : isMobile ? (
                /* 모바일 카드 뷰 */
                renderMobileView()
            ) : (
                /* 데스크톱 테이블 뷰 */
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                    <table className="w-full table-fixed min-w-[800px]">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                {visibleColumns.map((col, index) => (
                                    <th
                                        key={index}
                                        className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300"
                                        style={{ width: col.width || (col.flex ? `${col.flex * 100}%` : 'auto') }}
                                    >
                                        {col.checkboxSelection || col.headerCheckboxSelection ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleSelectAll}
                                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                                        allSelected
                                                            ? 'bg-sky-500 border-sky-500 dark:bg-sky-600 dark:border-sky-600'
                                                            : 'border-slate-300 dark:border-slate-600 hover:border-sky-400 dark:hover:border-sky-500'
                                                    }`}
                                                >
                                                    {allSelected && <Check size={14} className="text-white" />}
                                                </button>
                                                <span>{col.headerName}</span>
                                            </div>
                                        ) : (
                                            col.headerName
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {rowData.map((row, rowIndex) => {
                                const isSelected = selectedRows.has(row.id);
                                const isNotice = row.notice;
                                return (
                                    <tr
                                        key={row.id || rowIndex}
                                        className={`transition-colors ${
                                            isNotice
                                                ? 'bg-blue-50/50 dark:bg-blue-900/20 border-l-4 border-l-blue-600 dark:border-l-blue-300'
                                                : isSelected
                                                ? 'bg-sky-50 dark:bg-sky-900/20'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                        }`}
                                    >
                                        {visibleColumns.map((col, colIndex) => {
                                            if (col.checkboxSelection) {
                                                return (
                                                    <td key={colIndex} className="px-4 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSelectRow(row.id);
                                                                }}
                                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                                                    isSelected
                                                                        ? 'bg-sky-500 border-sky-500 dark:bg-sky-600 dark:border-sky-600'
                                                                        : 'border-slate-300 dark:border-slate-600 hover:border-sky-400 dark:hover:border-sky-500'
                                                                }`}
                                                            >
                                                                {isSelected && <Check size={14} className="text-white" />}
                                                            </button>
                                                            <span className="text-sm text-slate-600 dark:text-slate-400">{row.id}</span>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            let cellValue = row[col.field];
                                            let cellHtml = null;

                                            if (col.cellRenderer && typeof col.cellRenderer === 'function') {
                                                cellHtml = col.cellRenderer({ value: cellValue, data: row });
                                            } else if (col.valueFormatter && typeof col.valueFormatter === 'function') {
                                                cellValue = col.valueFormatter({ value: cellValue });
                                            }

                                            return (
                                                <td
                                                    key={colIndex}
                                                    className="px-4 py-4 text-sm text-slate-900 dark:text-slate-100 cursor-pointer"
                                                    onClick={() => handleRowClick(row, col.checkboxSelection ? 'checkbox' : col.field)}
                                                >
                                                    {cellHtml ? (
                                                        <div dangerouslySetInnerHTML={{ __html: cellHtml }} />
                                                    ) : (
                                                        <div className={col.field === 'author' ? 'truncate max-w-xs' : 'line-clamp-2'}>
                                                            {col.field === 'title' ? (
                                                                <span className="font-medium hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                                                                    {cellValue}
                                                                </span>
                                                            ) : col.field === 'author' ? (
                                                                <span className="text-sm" title={cellValue}>
                                                                    {cellValue}
                                                                </span>
                                                            ) : (
                                                                cellValue
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
});

CustomTable.displayName = 'CustomTable';

export default CustomTable;
