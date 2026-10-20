import { useState, useEffect } from 'react';
import { send } from '@/util/ClientUtil';
import { calcFxPnl, calcTotalPnlKrw } from '@/util/SellRecordUtil';
import PageTitle from '@/component/common/display/PageTitle';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import Button from '@/component/common/button/Button';
import SellRecordModal from './popup/SellRecordModal';
import SellRecordDetailModal from './popup/SellRecordDetailModal';
import SellRecordStatsModal from './popup/SellRecordStatsModal';

// 테이블 컬럼 너비 설정
// Tailwind 유효한 width 값: w-12, w-14, w-16, w-20, w-24, w-28, w-32, w-36, w-40, w-44, w-48 등
const COLUMN_WIDTHS = {
    sellDate: 'w-20',               // 매도일
    symbol: 'w-14',                 // 티커
    companyName: 'w-30',            // 기업명
    sellPrice: 'w-28',              // 매도가
    sellQty: 'w-16',                // 수량 (w-15는 유효하지 않음, w-16 사용)
    sellAmount: 'w-28',             // 매도금액
    realizedPnl: 'w-28',            // 실현손익
    buyExchangeRateAtTrade: 'w-20', // 매수당시환율
    sellExchangeRateAtTrade: 'w-20',// 매도당시환율
    fxPnl: 'w-24',                  // 환차손익
    totalPnl: 'w-28',               // 총손익
    rmk: 'w-30',                    // 비고
    manage: 'w-25',                 // 관리
};

export default function SellRecordHistory() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null, onAfterClose: null });
    const [confirmConfig, setConfirmConfig] = useState({ open: false, message: '', onConfirm: null });
    const [modalConfig, setModalConfig] = useState({ open: false, mode: 'add', data: null });
    const [detailModalConfig, setDetailModalConfig] = useState({ open: false, data: null });
    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState({ field: 'sellDate', direction: 'desc' });
    const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' or 'YYYY-MM'
    const [selectedSymbol, setSelectedSymbol] = useState('all'); // 'all' or ticker symbol
    const [fxRate, setFxRate] = useState(null);

    const openAlert = (message, onConfirm, onAfterClose) => {
        setAlertConfig({
            open: true,
            message,
            onConfirm: onConfirm || null,
            onAfterClose: onAfterClose || null
        });
    };

    const handleCloseAlert = () => {
        const { onAfterClose } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null, onAfterClose: null });
        if (onAfterClose) onAfterClose();
    };

    const openConfirm = (message, onConfirm) => {
        setConfirmConfig({ open: true, message, onConfirm: onConfirm || null });
    };

    const closeConfirm = () => {
        setConfirmConfig({ open: false, message: '', onConfirm: null });
    };

    // 데이터 조회
    const fetchRecords = async () => {
        setLoading(true);
        try {
            const { data, error } = await send('/dart/sellrecord', {}, 'GET');
            if (error) {
                openAlert(error);
                setRecords([]);
            } else if (data?.success && data?.response) {
                setRecords(data.response);
            } else {
                setRecords([]);
            }
        } catch {
            openAlert('데이터를 불러오는 중 오류가 발생했습니다.');
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
        fetchFxRate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 선택된 필터값이 유효하지 않으면 자동으로 'all'로 리셋
    useEffect(() => {
        // 월 목록 계산
        const months = selectedSymbol === 'all'
            ? [...new Set(records.map(r => r.sellDate.substring(0, 7)))]
            : [...new Set(records.filter(r => r.symbol === selectedSymbol).map(r => r.sellDate.substring(0, 7)))];

        // 현재 선택된 월이 유효하지 않으면 'all'로 리셋
        if (selectedMonth !== 'all' && !months.includes(selectedMonth)) {
            setSelectedMonth('all');
        }
    }, [selectedSymbol, records, selectedMonth]);

    useEffect(() => {
        // 티커 목록 계산
        const symbols = selectedMonth === 'all'
            ? [...new Set(records.map(r => r.symbol))]
            : [...new Set(records.filter(r => r.sellDate.startsWith(selectedMonth)).map(r => r.symbol))];

        // 현재 선택된 티커가 유효하지 않으면 'all'로 리셋
        if (selectedSymbol !== 'all' && !symbols.includes(selectedSymbol)) {
            setSelectedSymbol('all');
        }
    }, [selectedMonth, records, selectedSymbol]);

    // 환율 조회
    const fetchFxRate = async () => {
        try {
            const { data, error } = await send('/dart/tranrecord/rate', { currency: 'USDKRW' }, 'POST');
            if (!error && data?.success && data?.response) {
                setFxRate(data.response.rate || null);
            }
        } catch (e) {
            console.error('환율 조회 실패:', e);
        }
    };

    // 정렬
    const handleSort = (field) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // 월별 + 티커별 필터링
    const filteredRecords = records.filter(record => {
        const monthMatch = selectedMonth === 'all' || record.sellDate.startsWith(selectedMonth);
        const symbolMatch = selectedSymbol === 'all' || record.symbol === selectedSymbol;
        return monthMatch && symbolMatch;
    });

    // 월 목록 생성 - 선택된 티커에 따라 동적으로 변경
    const availableMonths = (() => {
        if (selectedSymbol === 'all') {
            // 전체 티커 선택 시: 모든 월 표시
            return [...new Set(records.map(r => r.sellDate.substring(0, 7)))].sort().reverse();
        } else {
            // 특정 티커 선택 시: 해당 티커가 존재하는 월만 표시
            return [...new Set(
                records
                    .filter(r => r.symbol === selectedSymbol)
                    .map(r => r.sellDate.substring(0, 7))
            )].sort().reverse();
        }
    })();

    // 티커 목록 생성 - 선택된 월에 따라 동적으로 변경
    const availableSymbols = (() => {
        if (selectedMonth === 'all') {
            // 전체 기간 선택 시: 모든 티커 표시
            return [...new Set(records.map(r => r.symbol))].sort();
        } else {
            // 특정 월 선택 시: 해당 월에 존재하는 티커만 표시
            return [...new Set(
                records
                    .filter(r => r.sellDate.startsWith(selectedMonth))
                    .map(r => r.symbol)
            )].sort();
        }
    })();

    const sortedRecords = [...filteredRecords].sort((a, b) => {
        const { field, direction } = sortConfig;
        let aVal = a[field];
        let bVal = b[field];

        if (field === 'sellDate') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 등록
    const handleAdd = () => {
        setModalConfig({ open: true, mode: 'add', data: null });
    };

    // 수정
    const handleEdit = (record) => {
        setModalConfig({ open: true, mode: 'edit', data: record });
    };

    // 상세보기
    const handleViewDetail = (record) => {
        setDetailModalConfig({ open: true, data: record });
    };

    // 삭제
    const handleDelete = (id) => {
        openConfirm('정말 삭제하시겠습니까?', async () => {
            try {
                const { data, error } = await send('/dart/sellrecord/del', { id }, 'POST');
                if (error) {
                    openAlert(error);
                } else if (data?.success) {
                    openAlert('삭제되었습니다.', null, () => fetchRecords());
                } else {
                    openAlert('삭제에 실패했습니다.');
                }
            } catch {
                openAlert('삭제 중 오류가 발생했습니다.');
            }
        });
    };

    // 모달 저장
    const handleSave = async (formData) => {
        const isEdit = modalConfig.mode === 'edit';
        const endpoint = isEdit ? '/dart/sellrecord/modi' : '/dart/sellrecord/regi';
        const payload = isEdit ? { id: modalConfig.data.id, ...formData } : formData;

        try {
            const { data, error } = await send(endpoint, payload, 'POST');
            if (error) {
                openAlert(error);
                return false;
            } else if (data?.success) {
                // 먼저 모달 닫기
                setModalConfig({ open: false, mode: 'add', data: null });
                // 그 다음 완료 알림 표시
                openAlert(`${isEdit ? '수정' : '등록'}되었습니다.`, null, () => {
                    fetchRecords();
                });
                return true;
            } else {
                openAlert(`${isEdit ? '수정' : '등록'}에 실패했습니다.`);
                return false;
            }
        } catch {
            openAlert(`${isEdit ? '수정' : '등록'} 중 오류가 발생했습니다.`);
            return false;
        }
    };

    // 통계 계산 (필터링된 데이터 기준)
    const stats = {
        totalRecords: filteredRecords.length,
        totalRealizedPnl: filteredRecords.reduce((sum, r) => sum + (r.realizedPnl || 0), 0),
        totalSellAmount: filteredRecords.reduce((sum, r) => sum + (r.sellPrice * r.sellQty || 0), 0),
        totalPnlKrw: filteredRecords.reduce((sum, r) => sum + (calcTotalPnlKrw(r, fxRate) || 0), 0),
    };

    // 평균 매도당시환율 계산 (없는 데이터는 현재환율 사용)
    const avgSellExchangeRate = filteredRecords.length > 0
        ? filteredRecords.reduce((sum, r) => sum + (r.sellExchangeRateAtTrade || fxRate || 0), 0) / filteredRecords.length
        : 0;

    return (
        <>
            <PageTitle />

            <div className="px-2 py-8 md:px-4 space-y-6">
                {/* 헤더 및 통계 */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">매도 현황 기록</h2>
                                <button
                                    onClick={() => { fetchRecords(); fetchFxRate(); }}
                                    disabled={loading}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                                    title="재조회"
                                >
                                    <svg className={`w-5 h-5 text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-1">
                                {fxRate && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>현재 환율: 1 USD = ₩{Math.round(fxRate).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>원화 금액은 매도당시환율 기준으로 계산됩니다 (데이터 없는 경우 현재환율 적용)</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            >
                                <option value="all">전체 기간</option>
                                {availableMonths.map(month => (
                                    <option key={month} value={month}>
                                        {month}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={selectedSymbol}
                                onChange={(e) => setSelectedSymbol(e.target.value)}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            >
                                <option value="all">전체 티커</option>
                                {availableSymbols.map(symbol => (
                                    <option key={symbol} value={symbol}>
                                        {symbol}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => setStatsModalOpen(true)}
                                disabled={filteredRecords.length === 0}
                                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2h14" />
                                </svg>
                                <span className="hidden sm:inline">통계 보기</span>
                            </button>
                            <Button onClick={handleAdd}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="hidden sm:inline">기록 추가</span>
                            </Button>
                        </div>
                    </div>

                    {/* 통계 카드 */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">총 매도 건수</div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalRecords}건</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">총 실현 손익</div>
                            <div className={`text-xl font-bold ${stats.totalRealizedPnl >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                ${stats.totalRealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {avgSellExchangeRate > 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    (₩{Math.round(stats.totalRealizedPnl * avgSellExchangeRate).toLocaleString()})
                                </div>
                            )}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">총 매도 금액</div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">
                                ${stats.totalSellAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {avgSellExchangeRate > 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    (₩{Math.round(stats.totalSellAmount * avgSellExchangeRate).toLocaleString()})
                                </div>
                            )}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">총손익 (가격+환차)</div>
                            <div className={`text-xl font-bold ${stats.totalPnlKrw >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {stats.totalPnlKrw >= 0 ? '+' : ''}₩{Math.round(stats.totalPnlKrw).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 테이블 */}
                <div>
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400"></div>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-20 text-slate-500 dark:text-slate-400">
                            <svg className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-lg font-medium">등록된 매도 기록이 없습니다</p>
                            <p className="text-sm mt-1">상단의 '기록 추가' 버튼을 눌러 첫 번째 기록을 추가해보세요</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto overflow-y-auto scrollbar-always max-h-[70vh] bg-white border border-slate-200 rounded-lg shadow-sm dark:bg-slate-800 dark:border-slate-700" style={{ scrollbarGutter: 'stable' }}>
                          <div style={{ minWidth: '1200px' }}>
                            <table className="w-full table-fixed border-separate border-spacing-0">
                                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/50">
                                    <tr>
                                        <SortableHeader field="sellDate" label="매도일" sortConfig={sortConfig} onSort={handleSort} width={COLUMN_WIDTHS.sellDate} />
                                        <SortableHeader field="symbol" label="티커" sortConfig={sortConfig} onSort={handleSort} width={COLUMN_WIDTHS.symbol} />
                                        <SortableHeader field="companyName" label="기업명" sortConfig={sortConfig} onSort={handleSort} width={COLUMN_WIDTHS.companyName} />
                                        <SortableHeader field="sellPrice" label="매도가" sortConfig={sortConfig} onSort={handleSort} width={COLUMN_WIDTHS.sellPrice} />
                                        <SortableHeader field="sellQty" label="수량" sortConfig={sortConfig} onSort={handleSort} width={COLUMN_WIDTHS.sellQty} />
                                        <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap ${COLUMN_WIDTHS.sellAmount}`}>매도금액</th>
                                        <SortableHeader field="realizedPnl" label="실현손익" sortConfig={sortConfig} onSort={handleSort} width={COLUMN_WIDTHS.realizedPnl} />
                                        <th className={`px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap ${COLUMN_WIDTHS.buyExchangeRateAtTrade}`}>매수당시환율</th>
                                        <th className={`px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap ${COLUMN_WIDTHS.sellExchangeRateAtTrade}`}>매도당시환율</th>
                                        <th className={`px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap ${COLUMN_WIDTHS.fxPnl}`}>환차손익</th>
                                        <th className={`px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap ${COLUMN_WIDTHS.totalPnl}`}>총손익</th>
                                        <th className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap ${COLUMN_WIDTHS.rmk}`}>비고</th>
                                        <th className={`px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap ${COLUMN_WIDTHS.manage}`}>관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {sortedRecords.map((record) => (
                                        <tr
                                            key={record.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                                            onDoubleClick={() => handleViewDetail(record)}
                                        >
                                            <td className="px-4 py-3 text-sm text-slate-900 dark:text-white whitespace-nowrap">
                                                {record.sellDate}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                                                {record.symbol}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                                {record.companyName}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                                                <div>${record.sellPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                {(() => {
                                                    const sellRate = record.sellExchangeRateAtTrade || fxRate;
                                                    return sellRate && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            (₩{Math.round(record.sellPrice * sellRate).toLocaleString()})
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900 dark:text-white text-right">
                                                {record.sellQty.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                                                <div>${(record.sellPrice * record.sellQty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                {(() => {
                                                    const sellRate = record.sellExchangeRateAtTrade || fxRate;
                                                    return sellRate && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                                            (₩{Math.round(record.sellPrice * record.sellQty * sellRate).toLocaleString()})
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className={`font-semibold ${record.realizedPnl >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                    {record.realizedPnl >= 0 ? '+' : ''}${record.realizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                {(() => {
                                                    const sellRate = record.sellExchangeRateAtTrade || fxRate;
                                                    return sellRate && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                                            ({record.realizedPnl >= 0 ? '+' : ''}₩{Math.round(record.realizedPnl * sellRate).toLocaleString()})
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 text-center">
                                                {record.buyExchangeRateAtTrade ? `₩${record.buyExchangeRateAtTrade.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 text-center">
                                                {record.sellExchangeRateAtTrade ? `₩${record.sellExchangeRateAtTrade.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                {(() => {
                                                    const fxPnl = calcFxPnl(record);
                                                    if (fxPnl === null) return <span className="text-slate-400 dark:text-slate-500">-</span>;
                                                    return (
                                                        <span className={`font-medium ${fxPnl >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                            {fxPnl >= 0 ? '+' : ''}₩{Math.round(fxPnl).toLocaleString()}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                {(() => {
                                                    const totalPnl = calcTotalPnlKrw(record, fxRate);
                                                    if (totalPnl === null) return <span className="text-slate-400 dark:text-slate-500">-</span>;
                                                    return (
                                                        <span className={`font-bold ${totalPnl >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                            {totalPnl >= 0 ? '+' : ''}₩{Math.round(totalPnl).toLocaleString()}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                                                {record.rmk || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(record)}
                                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-slate-700"
                                                        title="수정"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(record.id)}
                                                        className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors dark:text-slate-400 dark:hover:text-orange-400 dark:hover:bg-slate-700"
                                                        title="삭제"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                          </div>
                        </div>
                    )}
                </div>
            </div>

            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={handleCloseAlert}
                onConfirm={alertConfig.onConfirm}
                onAfterClose={alertConfig.onAfterClose}
            />

            <AlertModal
                open={confirmConfig.open}
                message={confirmConfig.message}
                onClose={closeConfirm}
                onConfirm={confirmConfig.onConfirm}
            />

            {modalConfig.open && (
                <SellRecordModal
                    isOpen={modalConfig.open}
                    mode={modalConfig.mode}
                    data={modalConfig.data}
                    onClose={() => setModalConfig({ open: false, mode: 'add', data: null })}
                    onSave={handleSave}
                />
            )}

            {detailModalConfig.open && (
                <SellRecordDetailModal
                    isOpen={detailModalConfig.open}
                    data={detailModalConfig.data}
                    fxRate={fxRate}
                    onClose={() => setDetailModalConfig({ open: false, data: null })}
                />
            )}

            {statsModalOpen && (
                <SellRecordStatsModal
                    isOpen={statsModalOpen}
                    records={sortedRecords}
                    fxRate={fxRate}
                    periodLabel={`${selectedMonth === 'all' ? '전체 기간' : selectedMonth} · ${selectedSymbol === 'all' ? '전체 티커' : selectedSymbol}`}
                    onClose={() => setStatsModalOpen(false)}
                />
            )}
        </>
    );
}

// 정렬 가능한 테이블 헤더
function SortableHeader({ field, label, sortConfig, onSort, width = '' }) {
    const isSorted = sortConfig.field === field;
    const direction = sortConfig.direction;

    return (
        <th
            className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors select-none whitespace-nowrap ${width}`}
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1">
                <span>{label}</span>
                <div className="flex flex-col flex-shrink-0">
                    <svg
                        className={`w-3 h-3 -mb-1 ${isSorted && direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" />
                    </svg>
                    <svg
                        className={`w-3 h-3 ${isSorted && direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" />
                    </svg>
                </div>
            </div>
        </th>
    );
}
