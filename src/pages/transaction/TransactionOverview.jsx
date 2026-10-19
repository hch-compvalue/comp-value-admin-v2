import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { TransactionHeader } from './components/TransactionHeader';
import { HoldingsTable } from './components/holdings/HoldingsTable';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { SearchFilterBar } from './components/SearchFilterBar';
import { useTransactions } from './hooks/useTransactions';
import { useFxRate } from './hooks/useFxRate';
import { useCurrencyPreference } from './hooks/useCurrencyPreference';
import { groupRowsBySymbol, mapGroupRowForDetailModal } from './utils/grouping';
import { calculateTotals, calculateDiffAndPercent } from './utils/calculations';
import { sortTransactionRows } from './utils/sorting';
import { filterBySearch, filterByPnl } from './utils/filtering';
import { toDisplayRows } from './utils/holdingModel';
import { FILTER_MODES } from './constants';
import CompanyValueResultModal from '@/pages/trade/popup/CompanyValueResultModal';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import SellModal from './components/SellModal';
import TransactionModal from './components/TransactionModal';
import TransactionDetailModal from './components/TransactionDetailModal';
import PageTitle from '@/component/common/display/PageTitle';
import { send, API_ENDPOINTS } from '@/util/ClientUtil';

export default function TransactionOverview() {
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null, onAfterClose: null });
    const [sortConfig, setSortConfig] = useState({ column: null, direction: 'asc' });
    const [searchText, setSearchText] = useState('');
    const [filterMode, setFilterMode] = useState(FILTER_MODES.ALL);

    const openAlert = (message, onConfirm, onAfterClose) => {
        setAlertConfig({ open: true, message, onConfirm: onConfirm || null, onAfterClose: onAfterClose || null });
    };

    const closeAlert = () => {
        const { onAfterClose } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null, onAfterClose: null });
        if (onAfterClose) {
            onAfterClose();
        }
    };

    const {
        rows,
        loading,
        saving,
        lastUpdated,
        addTransaction,
        updateTransactionField,
        updateTransactionFields,
        removeTransaction,
        mergePricesBySymbols,
        processSell,
        refetchTransactions,
        refreshSyncTarget,
    } = useTransactions(openAlert);

    const { fxRate, fxUpdatedAt, refreshFxRate } = useFxRate();
    const [showCompValueModal, setShowCompValueModal] = useState(false);
    const [compValueData, setCompValueData] = useState({});
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
    const [sellModalData, setSellModalData] = useState({ open: false, data: null, targetRows: [] });
    const [transactionModalData, setTransactionModalData] = useState({ open: false, mode: 'add', data: null });
    const [detailModalData, setDetailModalData] = useState({ open: false, row: null, isGroupRow: false });
    const [currency, setCurrency] = useCurrencyPreference();
    const [expandedSymbols, setExpandedSymbols] = useState(() => new Set()); // 펼친 종목 (기본: 전부 접힘)

    // 삭제 실행 (상세 모달에서 호출)
    const handleRemoveTransaction = async (id) => {
        const success = await removeTransaction(id);
        if (success) {
            openAlert('삭제되었습니다.');
        }
        return success;
    };

    // 종목 추가 모달 열기
    const handleOpenAddModal = () => {
        setTransactionModalData({ open: true, mode: 'add', data: null });
    };

    // 종목 추가/수정 저장
    const handleSaveTransaction = async (formData) => {
        const success = await addTransaction(formData, mergePricesBySymbols);
        if (success) {
            setTransactionModalData({ open: false, mode: 'add', data: null });
            openAlert('종목이 등록되었습니다.');
        }
        return success;
    };

    // 현재가 갱신
    const handleRefreshPrices = async () => {
        setIsRefreshing(true);
        try {
            await mergePricesBySymbols(rows.map((r) => r.symbol));
            await refreshFxRate();
            setLastRefreshedAt(new Date());
        } catch (e) {
            openAlert('현재가격/환율 갱신에 실패했습니다.');
        } finally {
            setIsRefreshing(false);
        }
    };

    // 행 클릭 시 상세정보 모달 열기 (종목 합계 행은 그룹 상세)
    const handleRowClick = (model) => {
        if (model.kind === 'group') {
            setDetailModalData({ open: true, row: mapGroupRowForDetailModal(model.source), isGroupRow: true });
        } else {
            setDetailModalData({ open: true, row: model.source, isGroupRow: false });
        }
    };

    // 종목 합계 행 펼치기/접기
    const handleToggleGroup = (symbol) => {
        setExpandedSymbols((prev) => {
            const next = new Set(prev);
            if (next.has(symbol)) next.delete(symbol);
            else next.add(symbol);
            return next;
        });
    };

    // 상세 모달 닫기
    const handleCloseDetailModal = () => {
        setDetailModalData({ open: false, row: null, isGroupRow: false });
    };

    // 상세 모달에서 필드 수정 (한 번의 API 호출로 모든 필드 전송)
    const handleDetailSave = async (id, updates) => {
        const success = await updateTransactionFields(id, updates);
        if (success) {
            setDetailModalData({ open: false, row: null });
            openAlert('수정되었습니다.');
        }
        return success;
    };

    // 그룹 행 상세 모달에서 필드 수정 (그룹 내 모든 항목에 적용)
    const handleGroupDetailSave = async (groupRows, updates) => {
        let success = true;
        for (const groupRow of groupRows) {
            const result = await updateTransactionFields(groupRow.id, updates);
            if (!result) success = false;
        }
        if (success) {
            setDetailModalData({ open: false, row: null, isGroupRow: false });
            openAlert('그룹 내 모든 항목이 수정되었습니다.');
        }
        return success;
    };

    // 기업가치 분석 결과 모달 닫기
    // 동기화된 목표가를 반영하기 위해 목록 재조회 + 상세 모달 row도 갱신
    const handleCloseCompValueModal = async () => {
        setShowCompValueModal(false);

        const list = await refetchTransactions();
        if (!list || !detailModalData.open || !detailModalData.row) return;

        if (detailModalData.isGroupRow) {
            const symbol = String(detailModalData.row.symbol || '').toUpperCase();
            const regrouped = groupRowsBySymbol(list, fxRate);
            const newGroupRow = regrouped.find(
                (r) => r.__type === 'groupTotal' && String(r.symbol || '').toUpperCase() === symbol
            );
            if (newGroupRow) {
                // groupTotal raw 객체는 targetAvgUSD/buyAvgUSD/curUSD/qtySum 필드를 쓰는데
                // 상세 모달은 targetPrice/buyPrice/currentPrice/totalQty 필드를 보므로 매핑 필요
                // (없으면 동기화된 새 목표가가 detail modal 에 반영되지 않음)
                setDetailModalData((prev) => ({ ...prev, row: mapGroupRowForDetailModal(newGroupRow) }));
            }
        } else {
            const updatedRow = list.find((r) => r.id === detailModalData.row.id);
            if (updatedRow) {
                setDetailModalData((prev) => ({ ...prev, row: updatedRow }));
            }
        }
    };

    // 기업가치 분석 (상세 모달에서 호출)
    const handleAnalyze = async (symbol) => {
        if (!symbol || !symbol.trim()) {
            openAlert('티커 정보가 존재하지 않습니다.');
            return;
        }

        try {
            const url = API_ENDPOINTS.ABROAD_COMP_VALUE(symbol.trim());
            const { data, error } = await send(url, {}, 'GET');

            if (!error && data && data.response && Object.keys(data.response).length > 0) {
                setCompValueData(data.response);
                setShowCompValueModal(true);
            } else {
                openAlert('조회 결과가 존재하지 않거나 서버 응답을 받지 못했습니다.');
            }
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        }
    };

    // 정렬 핸들러
    const handleSort = (sortKey) => {
        setSortConfig(prev => ({
            column: sortKey,
            direction: prev.column === sortKey && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // 매도 모달 열기 (단일 행)
    const handleOpenSellModalSingle = (row) => {
        setSellModalData({
            open: true,
            data: {
                symbol: row.symbol,
                companyName: row.companyName,
                buyPrice: row.buyPrice,
                totalQty: row.totalBuyAmount || row.totalQty,
                currentPrice: row.currentPrice,
                buyExchangeRateAtTrade: row.buyExchangeRateAtTrade,
            },
            targetRows: row.groupRows || [row],
        });
    };

    // 매도 모달 열기 (합계 행)
    const handleOpenSellModalGroup = (groupData) => {
        setSellModalData({
            open: true,
            data: {
                symbol: groupData.symbol,
                companyName: groupData.companyName,
                buyPrice: groupData.buyPrice,
                totalQty: groupData.totalQty,
                currentPrice: groupData.currentPrice,
                buyExchangeRateAtTrade: groupData.buyExchangeRateAtTrade,
            },
            targetRows: groupData.groupRows || [],
        });
    };

    // 상세 모달에서 매도 트리거
    const handleSellFromDetail = (row) => {
        setDetailModalData({ open: false, row: null, isGroupRow: false });
        if (row.__type === 'groupTotal') {
            handleOpenSellModalGroup(row);
        } else {
            handleOpenSellModalSingle(row);
        }
    };

    // 매도 실행
    const handleConfirmSell = async (sellData) => {
        const result = await processSell(sellData, sellModalData.targetRows);
        if (result.success) {
            setSellModalData({ open: false, data: null, targetRows: [] });
            openAlert(`매도가 완료되었습니다.\n실현손익: $ ${result.realizedPnl?.toFixed(2) || 0}`);
        }
    };

    // 매도 모달 닫기
    const handleCloseSellModal = () => {
        setSellModalData({ open: false, data: null, targetRows: [] });
    };

    // 엑셀 다운로드
    const handleExcelDownload = () => {
        if (rows.length === 0) {
            openAlert('다운로드할 데이터가 없습니다.');
            return;
        }

        const now = new Date();
        const exportTime = now.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const sortedData = [...rows].sort((a, b) => {
            const dateA = a.buyDate ? new Date(a.buyDate) : new Date(0);
            const dateB = b.buyDate ? new Date(b.buyDate) : new Date(0);
            return dateA - dateB;
        });

        const excelData = sortedData.map((row) => {
            const buyPriceRate = row.buyExchangeRateAtTrade || fxRate;
            const buyAmountUSD = row.buyPrice * row.totalBuyAmount;
            const currentAmountUSD = row.currentPrice * row.totalBuyAmount;
            const diffUSD = currentAmountUSD - buyAmountUSD;

            return {
                '매수일자': row.buyDate || '',
                '티커': row.symbol || '',
                '기업명': row.companyName || '',
                '매수가($)': row.buyPrice?.toFixed(2) || '0.00',
                '수량': row.totalBuyAmount || 0,
                '매수금액($)': buyAmountUSD?.toFixed(2) || '0.00',
                '매수당시환율': row.buyExchangeRateAtTrade ? row.buyExchangeRateAtTrade.toFixed(2) : '-',
                '매수금액(₩)': Math.round(buyAmountUSD * buyPriceRate).toLocaleString() || '0',
                '현재가($)': row.currentPrice?.toFixed(2) || '0.00',
                '평가금액($)': currentAmountUSD?.toFixed(2) || '0.00',
                '평가금액(₩)': Math.round(currentAmountUSD * fxRate).toLocaleString() || '0',
                '손익($)': diffUSD?.toFixed(2) || '0.00',
                '손익률(%)': (((row.currentPrice - row.buyPrice) / row.buyPrice) * 100)?.toFixed(2) || '0.00',
                '손익(₩)': Math.round(diffUSD * fxRate).toLocaleString() || '0',
            };
        });

        const summaryRow = {
            '매수일자': '',
            '티커': '',
            '기업명': '전체 합계',
            '매수가($)': '',
            '수량': '',
            '매수금액($)': totals.buySum?.toFixed(2) || '0.00',
            '매수당시환율': '',
            '매수금액(₩)': Math.round(totals.buySum * fxRate).toLocaleString() || '0',
            '현재가($)': '',
            '평가금액($)': totals.curSum?.toFixed(2) || '0.00',
            '평가금액(₩)': Math.round(totals.curSum * fxRate).toLocaleString() || '0',
            '손익($)': diff?.toFixed(2) || '0.00',
            '손익률(%)': diffPct?.toFixed(2) || '0.00',
            '손익(₩)': Math.round(diff * fxRate).toLocaleString() || '0',
        };

        const worksheet = XLSX.utils.aoa_to_sheet([]);

        XLSX.utils.sheet_add_aoa(worksheet, [
            ['내보내기 시간:', exportTime],
            ['환율 (USD/KRW):', fxRate ? `1 USD = ${Number(fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}원` : '환율 정보 없음'],
            [],
        ], { origin: 'A1' });

        XLSX.utils.sheet_add_json(worksheet, [...excelData, {}, summaryRow], { origin: 'A4' });

        const columnWidths = [
            { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 10 },
            { wch: 15 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 15 },
            { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 18 },
        ];
        worksheet['!cols'] = columnWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '거래내역');

        const today = new Date();
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const fileName = `거래내역_${dateStr}.xlsx`;

        XLSX.writeFile(workbook, fileName);
    };

    // 정렬된 행 목록
    const sortedRows = useMemo(() => {
        if (sortConfig.column === null) {
            return rows;
        }
        return sortTransactionRows(rows, sortConfig.column, sortConfig.direction);
    }, [rows, sortConfig]);

    // 필터링된 행 목록
    const filteredRows = useMemo(() => {
        return filterByPnl(filterBySearch(sortedRows, searchText), filterMode);
    }, [sortedRows, searchText, filterMode]);

    // 그룹화된 행 목록
    const groupedRows = useMemo(() => groupRowsBySymbol(filteredRows, fxRate), [filteredRows, fxRate]);

    // 화면 표시 행 (같은 종목은 합계 행 + 펼친 경우만 개별 매수)
    const displayRows = useMemo(() => toDisplayRows(groupedRows, expandedSymbols), [groupedRows, expandedSymbols]);

    // 전체 합계 계산 (필터 전 전체 데이터 기준)
    const totals = useMemo(() => calculateTotals(rows), [rows]);
    const { diff, diffPct } = useMemo(
        () => calculateDiffAndPercent(totals.buySum, totals.curSum),
        [totals.buySum, totals.curSum]
    );

    // 통계용 데이터
    const uniqueSymbols = new Set(rows.map(row => row.symbol)).size;

    return (
        <>
            <PageTitle />

            <PortfolioDashboard
                buySum={totals.buySum}
                curSum={totals.curSum}
                diff={diff}
                diffPct={diffPct}
                fx={fxRate}
                fxUpdatedAt={fxUpdatedAt}
                lastUpdated={lastUpdated}
            />

            <div className="px-2 py-8 md:px-4">
                <TransactionHeader
                    loading={loading || isRefreshing}
                    rows={rows}
                    onRefresh={handleRefreshPrices}
                    onAddClick={handleOpenAddModal}
                    onExcelDownload={handleExcelDownload}
                    lastRefreshedAt={lastRefreshedAt}
                />

                <SearchFilterBar
                    searchText={searchText}
                    onSearchChange={setSearchText}
                    filterMode={filterMode}
                    onFilterModeChange={setFilterMode}
                    uniqueSymbols={uniqueSymbols}
                    totalRows={rows.length}
                    currency={currency}
                    onCurrencyChange={setCurrency}
                    fxAvailable={fxRate > 0}
                />

                <HoldingsTable
                    displayRows={displayRows}
                    ctx={{ currency, fx: fxRate, expandedSymbols, onToggleGroup: handleToggleGroup }}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    onRowClick={handleRowClick}
                    emptyMessage={loading ? null : rows.length === 0 ? '등록된 종목이 없습니다. 위의 종목 추가 버튼으로 시작하세요.' : '검색 결과가 없습니다'}
                />

                {loading && <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">불러오는 중…</div>}
                {saving && <div className="mt-3 text-sm text-blue-600 font-medium dark:text-blue-400">저장 중...</div>}
            </div>

            <CompanyValueResultModal
                isOpen={showCompValueModal}
                onClose={handleCloseCompValueModal}
                data={compValueData}
            />

            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={closeAlert}
                onConfirm={alertConfig.onConfirm}
            />

            <SellModal
                open={sellModalData.open}
                onClose={handleCloseSellModal}
                onConfirm={handleConfirmSell}
                data={sellModalData.data}
                fx={fxRate}
                saving={saving}
            />

            <TransactionModal
                isOpen={transactionModalData.open}
                mode={transactionModalData.mode}
                data={transactionModalData.data}
                onClose={() => setTransactionModalData({ open: false, mode: 'add', data: null })}
                onSave={handleSaveTransaction}
            />

            <TransactionDetailModal
                isOpen={detailModalData.open}
                row={detailModalData.row}
                fx={fxRate}
                onClose={handleCloseDetailModal}
                onSave={handleDetailSave}
                onGroupSave={handleGroupDetailSave}
                onAnalyze={handleAnalyze}
                onRefreshSyncTarget={refreshSyncTarget}
                onSell={handleSellFromDetail}
                onRemove={handleRemoveTransaction}
                onOpenAlert={openAlert}
                saving={saving}
                isGroupRow={detailModalData.isGroupRow}
            />
        </>
    );
}
