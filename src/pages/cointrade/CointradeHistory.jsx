import { useState, useEffect, useMemo, useCallback } from 'react';
import { send } from '@/util/ClientUtil';
import useModalAnimation from '@/hooks/useModalAnimation';
import HistoryStatsModal from './popup/HistoryStatsModal';
import Toast from '@/component/common/display/Toast';
import PageTitle from '@/component/common/display/PageTitle';
import ExcelFilter from '@/component/common/table/ExcelFilter';
import Input from '@/component/common/input/Input';
import Button from '@/component/common/button/Button';
import ExcelJS from 'exceljs';
import HistorySummaryPanel, { MarketBadge } from './history/HistorySummaryPanel';
import {
    HISTORY_API, HISTORY_CODES_API, HISTORY_TABS, MARKET_META, PAGE_SIZE_ALL,
    tabMarket, marketOf, isLegacyRecord, displayName, displayKrw, formatQty, qtyDecimalsOf,
    loadSavedTab, saveTab, loadSavedLegacy, saveLegacy, fetchSymbolNames,
    computeFlow, computeFlowByMarket, computeLegacyStats,
} from './history/historyCommon';

// 숫자를 천 단위 콤마 포맷으로 변환
const formatNumberWithComma = (value) => {
    if (value === null || value === '' || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    return num.toLocaleString('en-US');
};

// 가격 표시 컴포넌트 (정수부 볼드 + 그림자 처리)
const renderFormattedPrice = (value, unit = '원') => {
    if (value === null || value === '' || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';

    const str = num.toLocaleString('en-US');
    const parts = str.split('.');

    return (
        <span>
            <span className="font-extrabold" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)' }}>{parts[0]}</span>
            <span className="font-normal opacity-70">{parts.length > 1 && `.${parts[1]}`}</span>
            <span className="font-normal">{unit}</span>
        </span>
    );
};

// 소수점 숫자 볼드 처리 (수량 등)
const renderFormattedNumber = (value, decimals = 8) => {
    if (value === null || value === '' || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';

    const str = num.toFixed(decimals);
    const parts = str.split('.');

    return (
        <span>
            <span className="font-extrabold" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)' }}>{parts[0]}</span>
            <span className="font-normal opacity-70">{parts.length > 1 && `.${parts[1]}`}</span>
        </span>
    );
};

// 날짜 포맷 (YYYY-MM-DD HH:MM:SS)
const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

// 보유 시간 포맷 (초 → "Xh Ym Zs" 중 유효한 단위만)
const formatHoldDuration = (sec) => {
    if (sec == null) return '-';
    const s = Math.floor(Number(sec));
    if (!Number.isFinite(s) || s < 0) return '-';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${r}초`;
    return `${r}초`;
};

// 사유 색상
const getReasonColor = (reason) => {
    const colors = {
        'TREND_REBALANCE': 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
        'EMERGENCY_EXIT': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
        'MOMENTUM_SIGNAL': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        'SIGNAL': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        'PARTIAL_SIGNAL': 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
        'TAKE_PROFIT': 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300',
        'STOP_LOSS': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
        'PARTIAL_TAKE_PROFIT': 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400',
        'PARTIAL_STOP_LOSS': 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
        'TRAILING_STOP': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
        'PARTIAL_TRAILING_STOP': 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
        'MANUAL': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
        'PARTIAL_MANUAL': 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
        'MANUAL_CLEANUP': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
        'CLEANUP_NO_BALANCE': 'bg-slate-200 dark:bg-slate-600/30 text-slate-700 dark:text-slate-300',
        'MAX_HOLD_EXPIRED': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
        'MAX_HOLDING_EXPIRED': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
    };

    if (colors[reason]) return colors[reason];

    // {N}DAY_PROFIT 패턴
    if (/^\d+DAY_PROFIT$/.test(reason)) {
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
    }
    if (/^PARTIAL_\d+DAY_PROFIT$/.test(reason)) {
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400';
    }

    return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
};

// 사유 라벨
const getReasonLabel = (reason) => {
    const labels = {
        'TREND_REBALANCE': '추세 리밸런싱',
        'EMERGENCY_EXIT': '긴급 매도',
        'MOMENTUM_SIGNAL': '모멘텀 진입',
        'SIGNAL': '매수',
        'PARTIAL_SIGNAL': '부분매수',
        'TAKE_PROFIT': '익절',
        'STOP_LOSS': '손절',
        'PARTIAL_TAKE_PROFIT': '부분익절',
        'PARTIAL_STOP_LOSS': '부분손절',
        'TRAILING_STOP': '트레일링스탑',
        'PARTIAL_TRAILING_STOP': '부분트레일링',
        'MANUAL': '수동매도',
        'MANUAL_CLEANUP': '수동정리',
        'CLEANUP_NO_BALANCE': '잔고정리',
        'PARTIAL_MANUAL': '부분수동',
        'MAX_HOLD_EXPIRED': '강제청산',
        'MAX_HOLDING_EXPIRED': '강제청산'
    };

    if (labels[reason]) return labels[reason];

    // {N}DAY_PROFIT 패턴
    const dayProfitMatch = reason?.match(/^(\d+)DAY_PROFIT$/);
    if (dayProfitMatch) return `${dayProfitMatch[1]}일수익`;

    const partialDayProfitMatch = reason?.match(/^PARTIAL_(\d+)DAY_PROFIT$/);
    if (partialDayProfitMatch) return `부분${partialDayProfitMatch[1]}일`;

    return reason;
};

// 컬럼 너비 정의
const COL_WIDTHS = {
    createdAt: '140px',
    coinCode: '260px',
    tradeType: '80px',
    price: '130px',
    quantity: '130px',
    totalAmount: '120px',
    reason: '100px',
    profitLoss: '120px',
    profitLossRate: '100px',
    momentumScore: '110px',
    mlConfidence: '100px',
    entryReason: '200px',
    holdDurationSec: '110px',
};

// 테이블 컬럼 정의
const TABLE_COLUMNS = [
    {
        key: 'createdAt',
        label: '일시',
        width: COL_WIDTHS.createdAt,
        sortable: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left text-slate-900 dark:text-slate-100',
        render: (value) => formatDateTime(value),
        getFilterLabel: (v) => formatDateTime(v),
    },
    {
        key: 'coinCode',
        label: '종목',
        width: COL_WIDTHS.coinCode,
        sortable: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left font-medium text-slate-900 dark:text-slate-100 overflow-hidden text-ellipsis',
        render: (value, _row, ctx) => value ? (
            <span className="inline-flex items-center gap-2" title={displayName(value, ctx.names)}>
                <MarketBadge market={marketOf(value)} />
                <span className="truncate">{displayName(value, ctx.names)}</span>
            </span>
        ) : '-',
        getFilterLabel: (v, ctx) => (v ? displayName(v, ctx.names) : '(비어있음)'),
    },
    {
        key: 'tradeType',
        label: '유형',
        width: COL_WIDTHS.tradeType,
        sortable: true,
        headerClassName: 'px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-center',
        render: (value) => (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${value === 'BUY'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                {value === 'BUY' ? '매수' : '매도'}
            </span>
        ),
        getFilterLabel: (v) => (v === 'BUY' ? '매수' : v === 'SELL' ? '매도' : (v ?? '(비어있음)')),
    },
    {
        key: 'price',
        label: '가격',
        width: COL_WIDTHS.price,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right text-slate-900 dark:text-slate-100',
        render: (value, row) => renderFormattedPrice(displayKrw(value, row), '원'),
        getFilterLabel: (v) => (v == null ? '(비어있음)' : `${formatNumberWithComma(v)}원`),
    },
    {
        key: 'quantity',
        label: '수량',
        width: COL_WIDTHS.quantity,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right text-slate-900 dark:text-slate-100',
        render: (value, row) => formatQty(value, row.coinCode),
        getFilterLabel: (v) => (v == null ? '(비어있음)' : String(v)),
    },
    {
        key: 'totalAmount',
        label: '금액',
        width: COL_WIDTHS.totalAmount,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right font-medium text-slate-900 dark:text-slate-100',
        render: (value, row) => renderFormattedPrice(displayKrw(value, row), '원'),
        getFilterLabel: (v) => (v == null ? '(비어있음)' : `${formatNumberWithComma(v)}원`),
    },
    {
        key: 'reason',
        label: '사유',
        width: COL_WIDTHS.reason,
        sortable: true,
        headerClassName: 'px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-center',
        render: (value) => value ? (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReasonColor(value)}`}>
                {getReasonLabel(value)}
            </span>
        ) : '-',
        getFilterLabel: (v) => (v ? getReasonLabel(v) : '(비어있음)'),
    },
    {
        key: 'profitLoss',
        legacyOnly: true, // 구 전략(v4 단타) 기록 포함 시에만 표시
        label: '손익',
        width: COL_WIDTHS.profitLoss,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value) => value != null ? (
            <span className={value >= 0 ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-orange-600 dark:text-orange-400 font-medium'}>
                {value >= 0 ? '+' : ''}{renderFormattedPrice(value, '원')}
            </span>
        ) : '-',
        getFilterLabel: (v) => (v == null ? '(비어있음)' : `${v >= 0 ? '+' : ''}${formatNumberWithComma(v)}원`),
    },
    {
        key: 'profitLossRate',
        legacyOnly: true, // 구 전략(v4 단타) 기록 포함 시에만 표시
        label: '손익률',
        width: COL_WIDTHS.profitLossRate,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value) => value != null ? (
            <span className={value >= 0 ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-orange-600 dark:text-orange-400 font-medium'}>
                {value >= 0 ? '+' : ''}{value.toFixed(2)}%
            </span>
        ) : '-',
        getFilterLabel: (v) => (v == null ? '(비어있음)' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`),
    },
    {
        key: 'momentumScore',
        legacyOnly: true, // 구 전략(v4 단타) 기록 포함 시에만 표시
        label: '모멘텀점수',
        width: COL_WIDTHS.momentumScore,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right text-slate-900 dark:text-slate-100',
        render: (value) => value != null ? Number(value).toFixed(4) : '-',
        getFilterLabel: (v) => (v == null ? '(비어있음)' : Number(v).toFixed(4)),
    },
    {
        key: 'mlConfidence',
        legacyOnly: true, // 구 전략(v4 단타) 기록 포함 시에만 표시
        label: 'ML확률',
        width: COL_WIDTHS.mlConfidence,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right text-slate-900 dark:text-slate-100',
        render: (value) => value != null ? `${(Number(value) * 100).toFixed(1)}%` : '-',
        getFilterLabel: (v) => (v == null ? '(비어있음)' : `${(Number(v) * 100).toFixed(1)}%`),
    },
    {
        key: 'entryReason',
        label: '비고', // 현재 전략: "목표 x% / 이전 y%", 구 전략: 진입사유
        width: COL_WIDTHS.entryReason,
        sortable: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left text-slate-700 dark:text-slate-300 overflow-hidden text-ellipsis',
        render: (value) => value || '-',
        getFilterLabel: (v) => (v == null || v === '' ? '(비어있음)' : v),
    },
    {
        key: 'holdDurationSec',
        legacyOnly: true, // 구 전략(v4 단타) 기록 포함 시에만 표시
        label: '보유시간',
        width: COL_WIDTHS.holdDurationSec,
        sortable: true,
        headerClassName: 'px-4 py-3 pr-8 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 pr-8 whitespace-nowrap text-right text-slate-700 dark:text-slate-300',
        render: (value) => formatHoldDuration(value),
        getFilterLabel: (v) => (v == null ? '(비어있음)' : formatHoldDuration(v)),
    }
];

// 엑셀 열 너비 (거래 목록: TRADE_HEADERS + LEGACY_TRADE_HEADERS 순서, 요약: 항목/값)
const EXCEL_TRADE_COL_WIDTHS = [20, 8, 28, 12, 8, 16, 18, 16, 14, 24, 16, 12, 12, 12, 12];
const EXCEL_SUMMARY_COL_WIDTHS = [32, 28];

// 테이블 최소 너비 (구 전략 컬럼 포함 시 넓게)
const TABLE_MIN_WIDTH = '1200px';
const TABLE_MIN_WIDTH_LEGACY = '1750px';
const DEFAULT_SORT = { key: 'createdAt', direction: 'desc' };
const LEGACY_ONLY_KEYS = new Set(TABLE_COLUMNS.filter(c => c.legacyOnly).map(c => c.key));

/**
 * 자동매매 거래기록 조회 페이지 (v3.0)
 * - 상단 탭으로 코인(btc_trend) / 주식(etf3_trend_v1) 구분 → market 파라미터
 * - 구 전략(v4 단타) 기록은 토글로 포함 → includeLegacy 파라미터, 손익·모멘텀·ML·보유시간 컬럼도 이때만 표시
 * - 테이블 디자인 (Sticky Header/Columns, Filter Row)
 */
export default function CointradeHistory() {
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // 상세보기 모달 상태
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const { shouldRender: renderDetailModal, isAnimatingOut: isDetailModalClosing } = useModalAnimation(isDetailModalOpen, 250);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

    // 검색 필터 (서버 조회용)
    const [filters, setFilters] = useState({
        startDate: '',
        startTime: '00:00',
        endDate: '',
        endTime: '23:59',
        coinCode: 'all',
        tradeType: 'all'     // all, BUY, SELL (매도 사유는 테이블 헤더 필터로 클라이언트 측에서 거름)
    });

    // 시장 탭(전체/코인/주식) · 구 전략(v4 단타) 포함 여부 — 조회 파라미터로 전달, localStorage 기억
    const [activeTab, setActiveTab] = useState(loadSavedTab);
    const [includeLegacy, setIncludeLegacy] = useState(loadSavedLegacy);
    // 종목코드 → 표시명 (전략 목록 기준, 없으면 코드 그대로)
    const [symbolNames, setSymbolNames] = useState({});

    // 테이블 내부 필터/정렬
    const [columnFilters, setColumnFilters] = useState({});
    const [sortConfig, setSortConfig] = useState(DEFAULT_SORT);

    // 데이터
    const [records, setRecords] = useState([]);
    const [coinList, setCoinList] = useState([]);

    // 페이지네이션 (서버 사이드)
    const [currentPage, setCurrentPage] = useState(0); // 0-based for server
    const [itemsPerPage, setItemsPerPage] = useState(PAGE_SIZE_ALL);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);


    // Toast auto-hide
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }, [toast]);

    // 페이지 로드 시 기본 기간 설정 (시작일: 한달전 00:00, 종료일: 오늘 23:59 — 하루 전체 범위)
    useEffect(() => {
        const today = new Date();
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(today.getMonth() - 1);

        // 로컬 날짜 문자열 (YYYY-MM-DD)
        const formatDate = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        setFilters(prev => ({
            ...prev,
            startDate: formatDate(oneMonthAgo),
            startTime: '00:00',
            endDate: formatDate(today),
            endTime: '23:59'
        }));

        fetchCoinList();
        fetchSymbolNames().then(setSymbolNames).catch((e) => console.error('전략 종목명 조회 실패:', e));
    }, []);

    // 종목 목록 조회
    const fetchCoinList = async () => {
        try {
            // 거래기록에 존재하는 종목 코드 목록 (string[], 정렬됨)
            const { data, error } = await send(HISTORY_CODES_API, {}, 'GET');
            if (!error && data?.success && Array.isArray(data?.response)) {
                setCoinList(data.response);
            }
        } catch (e) {
            console.error('종목 목록 조회 실패:', e);
        }
    };

    // 선택 탭 시장의 종목만 (종목 필터 드롭다운용)
    const marketCoinList = useMemo(() => {
        const market = tabMarket(activeTab);
        return market ? coinList.filter(code => marketOf(code) === market) : coinList;
    }, [coinList, activeTab]);

    // 거래기록 조회 (overrides: 탭/토글 변경 직후 아직 반영 전인 상태값 { tabKey, legacy, coinCode })
    const handleSearch = async (page = 0, size = null, overrides = {}) => {
        if (!filters.startDate || !filters.endDate) {
            setToast('조회 기간을 선택해주세요.');
            return;
        }

        const pageSize = size !== null ? size : itemsPerPage;
        const market = tabMarket(overrides.tabKey ?? activeTab);
        const legacy = overrides.legacy ?? includeLegacy;
        const coinCode = overrides.coinCode ?? filters.coinCode;

        setLoading(true);
        try {
            // 날짜와 시간 조립 (ISO 8601 형식)
            const startDateTime = `${filters.startDate}T${filters.startTime}:00`;
            const endDateTime = `${filters.endDate}T${filters.endTime}:59`;

            // 쿼리 파라미터 생성 (페이징 포함)
            const params = new URLSearchParams({
                startDate: startDateTime,
                endDate: endDateTime,
                page: page.toString(),
                size: pageSize.toString()
            });

            if (coinCode !== 'all') {
                params.append('coinCode', coinCode);
            }
            if (filters.tradeType !== 'all') {
                params.append('tradeType', filters.tradeType);
            }
            if (market) {
                params.append('market', market);
            }
            params.append('includeLegacy', String(legacy));

            const { data, error } = await send(`${HISTORY_API}?${params.toString()}`, {}, 'GET');

            if (error) {
                setToast('조회 실패: ' + error);
                setRecords([]);
                setTotalElements(0);
                setTotalPages(0);
            } else if (data?.success && data?.response) {
                if (data.response.content.length === 0 && page === 0) {
                    setToast('조회된 거래기록이 없습니다.');
                }
                setRecords(data.response.content);
                setTotalElements(data.response.totalElements || 0);
                setTotalPages(data.response.totalPages || 0);
                setCurrentPage(page);
            }
        } catch (e) {
            console.error('거래기록 조회 실패:', e);
            setToast('조회 중 오류가 발생했습니다.');
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    // 탭 변경 → market 파라미터로 다시 조회 (다른 시장 종목이 선택돼 있으면 해제)
    const handleTabChange = (tabKey) => {
        if (tabKey === activeTab) return;
        const market = tabMarket(tabKey);
        const coinCode = market && filters.coinCode !== 'all' && marketOf(filters.coinCode) !== market ? 'all' : filters.coinCode;
        setActiveTab(tabKey);
        saveTab(tabKey);
        setFilters(prev => ({ ...prev, coinCode }));
        setColumnFilters({});
        handleSearch(0, null, { tabKey, coinCode });
    };

    // 구 전략(v4 단타) 포함 토글 → includeLegacy 파라미터로 다시 조회
    const handleLegacyToggle = () => {
        const next = !includeLegacy;
        setIncludeLegacy(next);
        saveLegacy(next);
        setColumnFilters({});
        if (!next && LEGACY_ONLY_KEYS.has(sortConfig.key)) setSortConfig(DEFAULT_SORT);
        handleSearch(0, null, { legacy: next });
    };

    // 필터 변경
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // 테이블 컬럼 필터 변경 (엑셀 스타일 - 선택된 값 배열)
    // selectedValues === undefined → 필터 해제, [] → 전체 제외(빈 결과)
    const handleColumnFilterChange = useCallback((key, selectedValues) => {
        setColumnFilters((prev) => {
            const next = { ...prev };
            if (selectedValues === undefined) delete next[key];
            else next[key] = selectedValues;
            return next;
        });
    }, []);

    // 필터 초기화
    const clearColumnFilters = useCallback(() => {
        setColumnFilters({});
    }, []);

    // 정렬 핸들러 (direction 지정 시 토글 대신 그대로 적용)
    const handleSort = useCallback((key, direction) => {
        setSortConfig((prev) => {
            if (direction) return { key, direction };
            return {
                key,
                direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
            };
        });
    }, []);

    // 표시 컬럼 — 구 전략 전용 컬럼(손익/모멘텀/ML/보유시간)은 구 전략 포함 시에만
    const visibleColumns = useMemo(
        () => (includeLegacy ? TABLE_COLUMNS : TABLE_COLUMNS.filter(col => !col.legacyOnly)),
        [includeLegacy]
    );
    // 컬럼 render/getFilterLabel 공통 컨텍스트
    const columnCtx = useMemo(() => ({ names: symbolNames }), [symbolNames]);

    // 컬럼별 전체 원본 값 (엑셀 필터 옵션용, records 변경 시에만 재계산)
    const columnValuesMap = useMemo(() => {
        const map = {};
        visibleColumns.forEach(col => {
            map[col.key] = records.map(r => r[col.key]);
        });
        return map;
    }, [records, visibleColumns]);

    // 클라이언트 사이드 필터링 및 정렬 데이터
    const processedData = useMemo(() => {
        // 1. 필터링: 선택된 값 배열과 셀 값(문자열화) 일치 확인
        let data = records.filter(row => {
            return Object.entries(columnFilters).every(([key, selectedValues]) => {
                if (selectedValues === undefined) return true;
                if (selectedValues.length === 0) return false;
                const cellValue = row[key];
                const cellKey = cellValue === null || cellValue === undefined ? null : String(cellValue);
                return selectedValues.some((sv) => {
                    if (sv === null) return cellKey === null;
                    return sv === cellKey;
                });
            });
        });

        // 2. 정렬
        if (sortConfig.key) {
            data.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return 1;
                if (bVal == null) return -1;

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }

                const aStr = String(aVal).toLowerCase();
                const bStr = String(bVal).toLowerCase();
                return sortConfig.direction === 'asc'
                    ? aStr.localeCompare(bStr)
                    : bStr.localeCompare(aStr);
            });
        }

        return data;
    }, [records, columnFilters, sortConfig]);

    // 서버 사이드 페이징 - processedData가 현재 페이지 데이터
    const currentRecords = processedData;

    // 페이지 변경 (서버에서 다시 조회)
    const handlePageChange = (page) => {
        handleSearch(page);
    };

    // 페이지 당 개수 변경
    const handleItemsPerPageChange = (e) => {
        const newSize = Number(e.target.value);
        setItemsPerPage(newSize);
        // 새 페이지 사이즈로 첫 페이지부터 다시 조회
        handleSearch(0, newSize);
    };

    // ====== 다운로드 유틸 ======
    const triggerDownload = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getTimestamp = () => {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    };

    const activeTabLabel = HISTORY_TABS.find(t => t.key === activeTab)?.label ?? '';

    // 요약 데이터를 행 배열로 변환 (현재 전략: 시장별 흐름, 구 전략 포함 시 v4 손익 통계 추가)
    const getSummaryRows = () => {
        const won = (v) => `${Math.floor(v).toLocaleString()}원`;
        const signedWon = (v) => `${v >= 0 ? '+' : ''}${won(v)}`;
        const flowRows = (prefix, f) => [
            [`${prefix}매수 건수`, `${f.buyCount}건`],
            [`${prefix}매수 금액`, won(f.buyAmount)],
            [`${prefix}매도 건수`, `${f.sellCount}건`],
            [`${prefix}매도 금액`, won(f.sellAmount)],
            [`${prefix}순매수(매수-매도)`, signedWon(f.netBuy)],
        ];
        const currentRows = records.filter(r => !isLegacyRecord(r));
        const market = tabMarket(activeTab);
        const rows = [
            ['조회 탭', activeTabLabel],
            ['구 전략(v4) 포함', includeLegacy ? '예' : '아니오'],
            ...flowRows('[현재 전략] ', computeFlow(currentRows)),
        ];
        if (!market) {
            const byMarket = computeFlowByMarket(currentRows);
            Object.keys(byMarket).forEach(m => rows.push(...flowRows(`[${MARKET_META[m].label}] `, byMarket[m])));
        }
        if (!includeLegacy) return rows;

        const legacy = computeLegacyStats(records.filter(isLegacyRecord));
        const pct = (count) => (legacy.sellCount > 0 ? `${(count / legacy.sellCount * 100).toFixed(1)}%` : '0.0%');
        return [
            ...rows,
            ...flowRows('[구 전략(v4)] ', legacy),
            ['[구 전략(v4)] 승률', `${legacy.winRate.toFixed(1)}% (${legacy.winCount}/${legacy.sellCount}건)`],
            ['[구 전략(v4)] 실현 손익', signedWon(legacy.totalProfit)],
            ...legacy.reasons.flatMap(({ label, count, amount }) => [
                [`[구 전략(v4)] ${label} 건수`, `${count}건`],
                [`[구 전략(v4)] ${label} 비율`, pct(count)],
                [`[구 전략(v4)] ${label} 손익`, count === 0 ? '-' : signedWon(amount)],
            ]),
            ['[구 전략(v4)] 실현 수익률', `${legacy.realizedProfitRate >= 0 ? '+' : ''}${legacy.realizedProfitRate.toFixed(2)}%`],
        ];
    };

    // 거래 목록 → plain 값 행 배열 변환 (구 전략 컬럼은 구 전략 포함 시에만)
    const getTradeRows = (data) => data.map(row => {
        const krw = (v) => {
            const n = displayKrw(v, row);
            return n != null ? `${formatNumberWithComma(n)}원` : '-';
        };
        const base = [
            row.createdAt ? formatDateTime(row.createdAt) : '-',
            row.coinCode ? MARKET_META[marketOf(row.coinCode)].label : '-',
            row.coinCode ? (symbolNames[row.coinCode] ?? row.coinCode) : '-',
            row.coinCode || '-',
            row.tradeType === 'BUY' ? '매수' : '매도',
            krw(row.price),
            formatQty(row.quantity, row.coinCode),
            krw(row.totalAmount),
            row.reason ? getReasonLabel(row.reason) : '-',
            row.entryReason || '-',
        ];
        if (!includeLegacy) return base;
        return [
            ...base,
            row.profitLoss != null ? `${row.profitLoss >= 0 ? '+' : ''}${formatNumberWithComma(row.profitLoss)}원` : '-',
            row.profitLossRate != null ? `${row.profitLossRate >= 0 ? '+' : ''}${row.profitLossRate.toFixed(2)}%` : '-',
            row.momentumScore != null ? Number(row.momentumScore).toFixed(4) : '-',
            row.mlConfidence != null ? `${(Number(row.mlConfidence) * 100).toFixed(1)}%` : '-',
            formatHoldDuration(row.holdDurationSec),
        ];
    });

    const TRADE_HEADERS = ['일시', '시장', '종목명', '종목코드', '유형', '가격', '수량', '금액', '사유', '비고'];
    const LEGACY_TRADE_HEADERS = ['손익', '손익률', '모멘텀점수', 'ML확률', '보유시간'];
    const tradeHeaders = includeLegacy ? [...TRADE_HEADERS, ...LEGACY_TRADE_HEADERS] : TRADE_HEADERS;
    const fileLabel = `거래기록_${activeTabLabel}${includeLegacy ? '_구전략포함' : ''}`;

    // CSV 문자열 생성
    const toCsv = (headers, rows) => {
        const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const lines = [headers.map(escape).join(',')];
        rows.forEach(r => lines.push(r.map(escape).join(',')));
        return '\uFEFF' + lines.join('\n'); // BOM for Excel 한글
    };

    // ── 요약 다운로드 ──
    const handleDownloadSummaryExcel = async () => {
        try {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('조회결과요약');

            // 헤더
            ws.addRow(['항목', '값']);
            ws.getRow(1).eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
                cell.alignment = { horizontal: 'center' };
            });

            getSummaryRows().forEach(r => ws.addRow(r));

            ws.getColumn(1).width = EXCEL_SUMMARY_COL_WIDTHS[0];
            ws.getColumn(2).width = EXCEL_SUMMARY_COL_WIDTHS[1];

            const buf = await wb.xlsx.writeBuffer();
            triggerDownload(
                new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
                `${fileLabel}_요약_${getTimestamp()}.xlsx`
            );
        } catch (e) {
            console.error('요약 엑셀 다운로드 실패:', e);
            setToast('엑셀 다운로드에 실패했습니다.');
        }
    };

    const handleDownloadSummaryCsv = () => {
        try {
            const csv = toCsv(['항목', '값'], getSummaryRows());
            triggerDownload(
                new Blob([csv], { type: 'text/csv;charset=utf-8' }),
                `${fileLabel}_요약_${getTimestamp()}.csv`
            );
        } catch (e) {
            console.error('요약 CSV 다운로드 실패:', e);
            setToast('CSV 다운로드에 실패했습니다.');
        }
    };

    // ── 거래 목록 다운로드 ──
    const handleDownloadTradeExcel = async () => {
        try {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('거래목록');

            // 헤더
            ws.addRow(tradeHeaders);
            ws.getRow(1).eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
                cell.alignment = { horizontal: 'center' };
            });

            const rows = getTradeRows(processedData);
            rows.forEach(r => ws.addRow(r));

            // 열 너비 자동 조정
            EXCEL_TRADE_COL_WIDTHS.slice(0, tradeHeaders.length).forEach((w, i) => { ws.getColumn(i + 1).width = w; });

            const buf = await wb.xlsx.writeBuffer();
            triggerDownload(
                new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
                `${fileLabel}_목록_${getTimestamp()}.xlsx`
            );
        } catch (e) {
            console.error('거래목록 엑셀 다운로드 실패:', e);
            setToast('엑셀 다운로드에 실패했습니다.');
        }
    };

    const handleDownloadTradeCsv = () => {
        try {
            const csv = toCsv(tradeHeaders, getTradeRows(processedData));
            triggerDownload(
                new Blob([csv], { type: 'text/csv;charset=utf-8' }),
                `${fileLabel}_목록_${getTimestamp()}.csv`
            );
        } catch (e) {
            console.error('거래목록 CSV 다운로드 실패:', e);
            setToast('CSV 다운로드에 실패했습니다.');
        }
    };

    // ====== 다운로드 버튼 컴포넌트 ======
    const DownloadButtons = ({ onExcel, onCsv }) => (
        <div className="flex items-center gap-1.5">
            <Button variant="success" size="sm" onClick={onExcel} title="엑셀 다운로드">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6l2.5 3L13 14l3 4H8l2-3z" />
                </svg>
                Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={onCsv} title="CSV 다운로드">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-2h8v-2H8v2zm0-4h8v-2H8v2z" />
                </svg>
                CSV
            </Button>
        </div>
    );

    // 상세보기 모달 핸들러
    const handleRowDoubleClick = (record) => {
        setSelectedRecord(record);
        setIsDetailModalOpen(true);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedRecord(null);
    };

    // ESC 키로 모달 닫기
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isDetailModalOpen) handleCloseDetailModal();
        };
        if (isDetailModalOpen) {
            window.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isDetailModalOpen]);

    // 상세보기 모달 컴포넌트
    const DetailModal = () => {
        if (!renderDetailModal || !selectedRecord) return null;

        const handleBackdropClick = (e) => {
            if (e.target === e.currentTarget) handleCloseDetailModal();
        };

        const isBuy = selectedRecord.tradeType === 'BUY';
        const isLegacy = isLegacyRecord(selectedRecord);
        const qtyDecimals = qtyDecimalsOf(selectedRecord.coinCode);

        return (
            <div
                className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 animate__animated ${isDetailModalClosing ? 'animate__fadeOut' : 'animate__fadeIn'}`}
                style={{ animationDuration: '0.25s' }}
                onClick={handleBackdropClick}
            >
                <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col animate__animated ${isDetailModalClosing ? 'animate__zoomOut' : 'animate__zoomIn'}`} style={{ animationDuration: '0.25s' }}>
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                        <div className="flex items-center gap-2 sm:gap-3">
                            {selectedRecord.coinCode && <MarketBadge market={marketOf(selectedRecord.coinCode)} />}
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                                {displayName(selectedRecord.coinCode, symbolNames)}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isBuy
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                }`}>
                                {isBuy ? '매수' : '매도'}
                            </span>
                            {(!isBuy || !isLegacy) && selectedRecord.reason && (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReasonColor(selectedRecord.reason)}`}>
                                    {getReasonLabel(selectedRecord.reason)}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleCloseDetailModal}
                            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* 콘텐츠 */}
                    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                        {/* 기본 정보 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {/* 거래일시 */}
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 sm:p-4">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">거래일시</div>
                                <div className="text-sm sm:text-base text-slate-800 dark:text-slate-200">
                                    {formatDateTime(selectedRecord.createdAt)}
                                </div>
                            </div>

                            {/* 거래유형 */}
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 sm:p-4">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">거래유형</div>
                                <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
                                    {isBuy ? '매수 (BUY)' : '매도 (SELL)'}
                                </div>
                            </div>

                            {/* 매도 사유 */}
                            {!isBuy && selectedRecord.reason && (
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 sm:p-4">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">매도 사유</div>
                                    <div className="text-sm sm:text-base">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReasonColor(selectedRecord.reason)}`}>
                                            {getReasonLabel(selectedRecord.reason)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 가격 및 수량 정보 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            {/* 거래 가격 */}
                            <div className={`rounded-lg p-3 sm:p-4 ${isBuy
                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                                : 'bg-slate-50 dark:bg-slate-700/50'
                                }`}>
                                <div className={`text-xs mb-1 ${isBuy
                                    ? 'text-blue-700 dark:text-blue-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                    }`}>
                                    {isBuy ? '매수가격' : '매도가격'}
                                </div>
                                <div className={`text-base sm:text-lg ${isBuy
                                    ? 'text-blue-800 dark:text-blue-300'
                                    : 'text-slate-800 dark:text-slate-200'
                                    }`}>
                                    {renderFormattedPrice(displayKrw(selectedRecord.price, selectedRecord), '원')}
                                </div>
                            </div>

                            {/* 수량 */}
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">수량</div>
                                <div className="text-base sm:text-lg text-slate-800 dark:text-slate-200">
                                    {selectedRecord.quantity ? renderFormattedNumber(selectedRecord.quantity, qtyDecimals) : '-'}
                                    {selectedRecord.quantity && qtyDecimals === 0 ? <span className="font-normal">주</span> : null}
                                </div>
                            </div>

                            {/* 총 금액 */}
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">총 금액</div>
                                <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
                                    {renderFormattedPrice(displayKrw(selectedRecord.totalAmount, selectedRecord), '원')}
                                </div>
                            </div>

                            {/* 매도시 원 매수가 표시 */}
                            {!isBuy && selectedRecord.buyPrice != null && (
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 sm:p-4">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">원 매수가</div>
                                    <div className="text-base sm:text-lg text-slate-800 dark:text-slate-200">
                                        {renderFormattedPrice(selectedRecord.buyPrice, '원')}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 매도의 경우 손익 정보 */}
                        {!isBuy && selectedRecord.profitLoss != null && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                {/* 손익금액 */}
                                <div className={`rounded-lg p-4 sm:p-5 ${selectedRecord.profitLoss >= 0
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                                    : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800'
                                    }`}>
                                    <div className={`text-xs mb-1 ${selectedRecord.profitLoss >= 0
                                        ? 'text-blue-700 dark:text-blue-400'
                                        : 'text-orange-700 dark:text-orange-400'
                                        }`}>
                                        손익금액
                                    </div>
                                    <div className={`text-xl sm:text-2xl font-bold ${selectedRecord.profitLoss >= 0
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-orange-600 dark:text-orange-400'
                                        }`}>
                                        {selectedRecord.profitLoss >= 0 ? '+' : ''}{renderFormattedPrice(selectedRecord.profitLoss, '원')}
                                    </div>
                                </div>

                                {/* 손익률 */}
                                <div className={`rounded-lg p-4 sm:p-5 ${selectedRecord.profitLossRate >= 0
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                                    : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800'
                                    }`}>
                                    <div className={`text-xs mb-1 ${selectedRecord.profitLossRate >= 0
                                        ? 'text-blue-700 dark:text-blue-400'
                                        : 'text-orange-700 dark:text-orange-400'
                                        }`}>
                                        손익률
                                    </div>
                                    <div className={`text-xl sm:text-2xl font-bold ${selectedRecord.profitLossRate >= 0
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-orange-600 dark:text-orange-400'
                                        }`}>
                                        {selectedRecord.profitLossRate >= 0 ? '+' : ''}{selectedRecord.profitLossRate.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 매수 진입 정보 (매수/매도 모두 - 매도는 보유 당시 진입 정보 유지) */}
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 rounded-lg p-4 sm:p-5 border border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{isLegacy ? '매수 진입 정보 (구 전략 v4)' : '비고'}</h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* 모멘텀 점수 */}
                                {selectedRecord.momentumScore != null && (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                        <div className="text-xs text-amber-700 dark:text-amber-400 mb-2">모멘텀 점수</div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                                                <div
                                                    className="bg-amber-500 dark:bg-amber-400 h-2 rounded-full"
                                                    style={{ width: `${Math.min(Number(selectedRecord.momentumScore) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-amber-700 dark:text-amber-400 font-bold">
                                                {Number(selectedRecord.momentumScore).toFixed(4)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* ML 확률 */}
                                {selectedRecord.mlConfidence != null && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                        <div className="text-xs text-blue-700 dark:text-blue-400 mb-2">ML 확률</div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                                                <div
                                                    className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full"
                                                    style={{ width: `${Math.min(Number(selectedRecord.mlConfidence) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-blue-600 dark:text-blue-400 font-bold">
                                                {(Number(selectedRecord.mlConfidence) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 진입 사유 */}
                                {selectedRecord.entryReason && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 sm:col-span-2">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{isLegacy ? '진입 사유' : '전략 메모'}</div>
                                        <div className="text-sm text-slate-800 dark:text-slate-200 break-all">
                                            {selectedRecord.entryReason}
                                        </div>
                                    </div>
                                )}

                                {/* 보유 시간 (hold_duration_sec 우선 사용) */}
                                {selectedRecord.holdDurationSec != null && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">보유 시간</div>
                                        <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
                                            {formatHoldDuration(selectedRecord.holdDurationSec)}
                                        </div>
                                    </div>
                                )}

                                {/* 매수일 (매도시) */}
                                {!isBuy && selectedRecord.buyDate && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">매수일시</div>
                                        <div className="text-sm text-slate-800 dark:text-slate-200">
                                            {formatDateTime(selectedRecord.buyDate)}
                                        </div>
                                    </div>
                                )}

                                {/* 보유기간 (매도시) */}
                                {!isBuy && selectedRecord.buyDate && selectedRecord.createdAt && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">보유기간</div>
                                        <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
                                            {(() => {
                                                const buyTime = new Date(selectedRecord.buyDate).getTime();
                                                const sellTime = new Date(selectedRecord.createdAt).getTime();
                                                const diffDays = Math.floor((sellTime - buyTime) / (1000 * 60 * 60 * 24));
                                                const diffHours = Math.floor(((sellTime - buyTime) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                return `${diffDays}일 ${diffHours}시간`;
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 기타 정보 */}
                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4 sm:p-5 border border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">기타 정보</h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* 거래 ID */}
                                {selectedRecord.id && (
                                    <div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">거래 ID</div>
                                        <div className="text-sm text-slate-800 dark:text-slate-200 font-mono">
                                            {selectedRecord.id}
                                        </div>
                                    </div>
                                )}

                                {/* UUID */}
                                {selectedRecord.uuid && (
                                    <div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">UUID</div>
                                        <div className="text-xs text-slate-800 dark:text-slate-200 font-mono break-all">
                                            {selectedRecord.uuid}
                                        </div>
                                    </div>
                                )}

                                {/* 주문 ID */}
                                {selectedRecord.orderId && (
                                    <div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">주문 ID</div>
                                        <div className="text-xs text-slate-800 dark:text-slate-200 font-mono break-all">
                                            {selectedRecord.orderId}
                                        </div>
                                    </div>
                                )}

                                {/* 수수료 */}
                                {selectedRecord.fee != null && (
                                    <div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">수수료</div>
                                        <div className="text-sm text-slate-800 dark:text-slate-200">
                                            {renderFormattedPrice(selectedRecord.fee, '원')}
                                        </div>
                                    </div>
                                )}

                                {/* 메모 */}
                                {selectedRecord.note && (
                                    <div className="sm:col-span-2">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">메모</div>
                                        <div className="text-sm text-slate-800 dark:text-slate-200">
                                            {selectedRecord.note}
                                        </div>
                                    </div>
                                )}

                                {/* 에러 메시지 */}
                                {selectedRecord.errorMessage && (
                                    <div className="sm:col-span-2">
                                        <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">에러 메시지</div>
                                        <div className="text-sm text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                                            {selectedRecord.errorMessage}
                                        </div>
                                    </div>
                                )}

                                {/* 나머지 모든 필드 동적 렌더링 */}
                                {Object.keys(selectedRecord).map(key => {
                                    const displayedKeys = [
                                        'coinCode', 'tradeType', 'reason', 'createdAt', 'price',
                                        'quantity', 'totalAmount', 'buyPrice', 'profitLoss', 'profitLossRate',
                                        'momentumScore', 'mlConfidence', 'entryReason', 'holdDurationSec',
                                        'buyDate',
                                        'id', 'uuid', 'orderId', 'fee', 'note', 'errorMessage'
                                    ];
                                    
                                    if (displayedKeys.includes(key)) return null;
                                    
                                    const value = selectedRecord[key];
                                    if (value === null || value === undefined || value === '') return null;

                                    return (
                                        <div key={key}>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 capitalize">
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </div>
                                            <div className="text-sm text-slate-800 dark:text-slate-200 break-all">
                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 전체 데이터 (개발용) */}
                        <details className="bg-slate-100 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700">
                            <summary className="px-4 py-3 cursor-pointer text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium">
                                전체 데이터 보기 (디버깅용)
                            </summary>
                            <div className="px-4 pb-4 pt-2">
                                <pre className="text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-3 rounded border border-slate-200 dark:border-slate-600 overflow-x-auto">
                                    {JSON.stringify(selectedRecord, null, 2)}
                                </pre>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="px-2 py-8 md:px-4">
            <PageTitle>거래기록 조회</PageTitle>

            {/* 시장 탭 (자동매매 화면 탭과 동일한 모양) */}
            <div role="tablist" className="flex gap-1 mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-slate-200 dark:border-slate-700">
                {HISTORY_TABS.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => handleTabChange(tab.key)}
                            disabled={loading}
                            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px disabled:cursor-not-allowed ${
                                isActive
                                    ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-500'
                            }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* 필터 영역 */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                    검색 조건
                </h2>

                <div className="space-y-4 mb-4">
                    {/* 기간 그룹 */}
                    <fieldset className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-900/10 px-4 pt-3 pb-4">
                        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                            기간
                        </legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    시작
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                        className="flex-1 min-w-0"
                                    />
                                    <Input
                                        type="time"
                                        value={filters.startTime}
                                        onChange={(e) => handleFilterChange('startTime', e.target.value)}
                                        className="w-36 flex-shrink-0"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    종료
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                        className="flex-1 min-w-0"
                                    />
                                    <Input
                                        type="time"
                                        value={filters.endTime}
                                        onChange={(e) => handleFilterChange('endTime', e.target.value)}
                                        className="w-36 flex-shrink-0"
                                    />
                                </div>
                            </div>
                        </div>
                    </fieldset>

                    {/* 거래 조건 그룹 */}
                    <fieldset className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-900/10 px-4 pt-3 pb-4">
                        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            거래 조건
                        </legend>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    종목
                                </label>
                                <select
                                    value={filters.coinCode}
                                    onChange={(e) => handleFilterChange('coinCode', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">전체</option>
                                    {marketCoinList.map(code => (
                                        <option key={code} value={code}>
                                            {activeTab === HISTORY_TABS[0].key ? `[${MARKET_META[marketOf(code)].label}] ` : ''}{displayName(code, symbolNames)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    거래 유형
                                </label>
                                <select
                                    value={filters.tradeType}
                                    onChange={(e) => handleFilterChange('tradeType', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">전체</option>
                                    <option value="BUY">매수</option>
                                    <option value="SELL">매도</option>
                                </select>
                            </div>
                            <div>
                                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    기록 범위
                                </span>
                                <label className="flex items-center gap-2 h-10 cursor-pointer select-none text-sm text-slate-700 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={includeLegacy}
                                        onChange={handleLegacyToggle}
                                        disabled={loading}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                    />
                                    구 전략 기록 포함 (v4 단타)
                                </label>
                            </div>
                        </div>
                    </fieldset>
                </div>

                {/* 검색 버튼 */}
                <div className="flex justify-end mt-4">
                    <Button
                        onClick={() => handleSearch(0)}
                        disabled={loading}
                    >
                        {loading ? '조회 중...' : '검색'}
                    </Button>
                </div>
            </div>

            {/* 요약 정보 */}
            {totalElements > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                                조회 결과 요약
                                {itemsPerPage !== PAGE_SIZE_ALL && (
                                    <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                                        (전체 보기로 조회 시 정확한 요약을 확인할 수 있습니다)
                                    </span>
                                )}
                            </h2>
                            <div className="flex flex-wrap items-center gap-x-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                <span>{filters.startDate} {filters.startTime} ~ {filters.endDate} {filters.endTime}</span>
                                <span>·</span>
                                <span>{totalElements.toLocaleString()}건</span>
                                <span>·</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{activeTabLabel}{includeLegacy ? ' (구 전략 포함)' : ''}</span>
                                {(filters.tradeType !== 'all' || filters.coinCode !== 'all') && (
                                    <>
                                        <span>·</span>
                                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                                            필터 적용됨
                                            ({[
                                                filters.tradeType !== 'all' && (filters.tradeType === 'BUY' ? '매수' : '매도'),
                                                filters.coinCode !== 'all' && displayName(filters.coinCode, symbolNames)
                                            ].filter(Boolean).join(', ')})
                                            — 조회 조건에 해당하는 데이터만 집계
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        {itemsPerPage === PAGE_SIZE_ALL && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsStatsModalOpen(true)}
                                    className="px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50"
                                    title="통계 보기"
                                >
                                    📊 통계 보기
                                </button>
                                <DownloadButtons onExcel={handleDownloadSummaryExcel} onCsv={handleDownloadSummaryCsv} />
                            </div>
                        )}
                    </div>

                    {itemsPerPage === PAGE_SIZE_ALL ? (
                        <HistorySummaryPanel records={records} activeTab={activeTab} includeLegacy={includeLegacy} />
                    ) : (
                        <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                            <p className="text-sm">총 <span className="font-bold text-slate-700 dark:text-slate-300">{totalElements.toLocaleString()}건</span>의 거래 내역이 있습니다.</p>
                            <p className="text-xs mt-1">"전체 보기"를 선택하면 상세 요약을 확인할 수 있습니다.</p>
                        </div>
                    )}
                </div>
            )}

            {/* 거래기록 테이블 */}
            <div>
                <div className="px-2 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">거래 목록</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            헤더의 <span className="inline-block align-middle w-4 h-4 bg-slate-600 text-white rounded text-[10px] leading-4 text-center">▾</span> 아이콘으로 필터·정렬
                        </span>
                        {currentRecords.length > 0 && (
                            <DownloadButtons onExcel={handleDownloadTradeExcel} onCsv={handleDownloadTradeCsv} />
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* 건수 선택 */}
                        <select
                            value={itemsPerPage}
                            onChange={handleItemsPerPageChange}
                            className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                        >
                            <option value={10}>10개씩 보기</option>
                            <option value={20}>20개씩 보기</option>
                            <option value={50}>50개씩 보기</option>
                            <option value={100}>100개씩 보기</option>
                            <option value={PAGE_SIZE_ALL}>전체 보기</option>
                        </select>

                        {Object.keys(columnFilters).length > 0 && (
                            <button
                                type="button"
                                onClick={clearColumnFilters}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                필터 초기화
                            </button>
                        )}
                        {totalElements > 0 && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium text-sm dark:bg-blue-900 dark:text-blue-200">
                                {itemsPerPage === PAGE_SIZE_ALL
                                    ? `전체 ${totalElements.toLocaleString()}건`
                                    : `${currentPage * itemsPerPage + 1}-${Math.min((currentPage + 1) * itemsPerPage, totalElements)} / 총 ${totalElements.toLocaleString()}건`}
                            </span>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto scrollbar-always bg-white border border-slate-200 rounded-lg shadow-sm max-h-[70vh] dark:bg-slate-800 dark:border-slate-700" style={{ scrollbarGutter: 'stable' }}>
                  <div style={{ minWidth: includeLegacy ? TABLE_MIN_WIDTH_LEGACY : TABLE_MIN_WIDTH }}>
                    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                        <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-700 to-slate-600 text-white">
                            <tr>
                                {visibleColumns.map((col, index) => {
                                    const isSorted = sortConfig.key === col.key;
                                    const sortDir = isSorted ? sortConfig.direction : null;
                                    const justify = col.headerClassName.includes('text-center')
                                        ? 'justify-center'
                                        : col.headerClassName.includes('text-right')
                                            ? 'justify-end'
                                            : 'justify-start';
                                    return (
                                        <th
                                            key={col.key}
                                            className={`${col.headerClassName} select-none ${col.sticky ? 'sticky z-20 bg-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]' : ''}`}
                                            style={{
                                                width: col.width,
                                                left: col.sticky ? (index === 0 ? 0 : col.left) : undefined
                                            }}
                                        >
                                            <div className={`flex items-center gap-1 ${justify}`}>
                                                <span
                                                    className={col.sortable ? 'cursor-pointer hover:text-yellow-300' : ''}
                                                    onClick={() => col.sortable && handleSort(col.key)}
                                                    title={col.sortable ? '클릭하여 정렬' : undefined}
                                                >
                                                    {col.label}
                                                </span>
                                                {col.sortable && isSorted && (
                                                    <span className="text-[10px] leading-none text-yellow-300">
                                                        {sortDir === 'asc' ? '▲' : '▼'}
                                                    </span>
                                                )}
                                                <ExcelFilter
                                                    allValues={columnValuesMap[col.key] || []}
                                                    selectedValues={columnFilters[col.key]}
                                                    onApply={(values) => handleColumnFilterChange(col.key, values)}
                                                    onSort={col.sortable ? (dir) => handleSort(col.key, dir) : undefined}
                                                    sortDirection={sortDir}
                                                    getOptionLabel={col.getFilterLabel ? (v) => col.getFilterLabel(v, columnCtx) : undefined}
                                                />
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : currentRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleColumns.length} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <svg
                                                className="w-12 h-12 text-slate-300 dark:text-slate-600"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={1.5}
                                                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                조회된 데이터가 없습니다.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                currentRecords.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        onDoubleClick={() => handleRowDoubleClick(row)}
                                        className="cursor-pointer hover:bg-blue-50 transition-colors dark:hover:bg-slate-700"
                                    >
                                        {visibleColumns.map((col, index) => {
                                            const value = row[col.key];
                                            const displayValue = col.render ? col.render(value, row, columnCtx) : (value ?? '-');

                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`${col.cellClassName} ${col.sticky ? 'sticky z-[5] bg-white dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                                                    style={{
                                                        width: col.width,
                                                        left: col.sticky ? (index === 0 ? 0 : col.left) : undefined
                                                    }}
                                                >
                                                    {displayValue}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                  </div>
                </div>

                {/* 페이지네이션 (서버 사이드) */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 px-4 py-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 0}
                            className="px-3 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 text-sm"
                        >
                            이전
                        </button>

                        {[...Array(totalPages)].map((_, i) => {
                            const page = i; // 0-based
                            const displayPage = i + 1; // 화면에는 1부터 표시
                            // 첫 페이지, 마지막 페이지, 현재 페이지 주변만 표시
                            if (
                                page === 0 ||
                                page === totalPages - 1 ||
                                (page >= currentPage - 2 && page <= currentPage + 2)
                            ) {
                                return (
                                    <button
                                        key={page}
                                        onClick={() => handlePageChange(page)}
                                        className={`px-3 py-1 rounded-md text-sm ${currentPage === page
                                            ? 'bg-blue-600 text-white font-medium'
                                            : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                                            }`}
                                    >
                                        {displayPage}
                                    </button>
                                );
                            } else if (page === currentPage - 3 || page === currentPage + 3) {
                                return <span key={page} className="text-slate-400">...</span>;
                            }
                            return null;
                        })}

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages - 1}
                            className="px-3 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 text-sm"
                        >
                            다음
                        </button>
                    </div>
                )}
            </div>

            {/* Toast 메시지 */}
            <Toast message={toast} />

            {/* 상세보기 모달 */}
            <DetailModal />

            {/* 통계 보기 모달 */}
            <HistoryStatsModal
                isOpen={isStatsModalOpen}
                onClose={() => setIsStatsModalOpen(false)}
                records={records}
                symbolNames={symbolNames}
                activeTab={activeTab}
                includeLegacy={includeLegacy}
                periodLabel={`${filters.startDate} ${filters.startTime} ~ ${filters.endDate} ${filters.endTime} · ${activeTabLabel}`}
            />
        </div>
    );
}