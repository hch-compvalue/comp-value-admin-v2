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
        'MOMENTUM_SIGNAL': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        'SIGNAL': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        'PARTIAL_SIGNAL': 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
        'TAKE_PROFIT': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        'STOP_LOSS': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
        'PARTIAL_TAKE_PROFIT': 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
        'PARTIAL_STOP_LOSS': 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
        'TRAILING_STOP': 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
        'PARTIAL_TRAILING_STOP': 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400',
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
    coinCode: '100px',
    tradeType: '80px',
    price: '80px',
    quantity: '130px',
    totalAmount: '120px',
    reason: '100px',
    profitLoss: '120px',
    profitLossRate: '100px',
    momentumScore: '110px',
    mlConfidence: '100px',
    entryReason: '180px',
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
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left font-medium text-slate-900 dark:text-slate-100',
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
        render: (value) => renderFormattedPrice(value, '원'),
        getFilterLabel: (v) => (v == null ? '(비어있음)' : `${formatNumberWithComma(v)}원`),
    },
    {
        key: 'quantity',
        label: '수량',
        width: COL_WIDTHS.quantity,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right text-slate-900 dark:text-slate-100',
        render: (value) => value ? value.toFixed(8) : '-',
        getFilterLabel: (v) => (v == null ? '(비어있음)' : Number(v).toFixed(8)),
    },
    {
        key: 'totalAmount',
        label: '금액',
        width: COL_WIDTHS.totalAmount,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right font-medium text-slate-900 dark:text-slate-100',
        render: (value) => renderFormattedPrice(value, '원'),
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
        label: '손익',
        width: COL_WIDTHS.profitLoss,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value) => value != null ? (
            <span className={value >= 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-blue-600 dark:text-blue-400 font-medium'}>
                {value >= 0 ? '+' : ''}{renderFormattedPrice(value, '원')}
            </span>
        ) : '-',
        getFilterLabel: (v) => (v == null ? '(비어있음)' : `${v >= 0 ? '+' : ''}${formatNumberWithComma(v)}원`),
    },
    {
        key: 'profitLossRate',
        label: '손익률',
        width: COL_WIDTHS.profitLossRate,
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value) => value != null ? (
            <span className={value >= 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-blue-600 dark:text-blue-400 font-medium'}>
                {value >= 0 ? '+' : ''}{value.toFixed(2)}%
            </span>
        ) : '-',
        getFilterLabel: (v) => (v == null ? '(비어있음)' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`),
    },
    {
        key: 'momentumScore',
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
        label: '진입사유',
        width: COL_WIDTHS.entryReason,
        sortable: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left text-slate-700 dark:text-slate-300 overflow-hidden text-ellipsis',
        render: (value) => value || '-',
        getFilterLabel: (v) => (v == null || v === '' ? '(비어있음)' : v),
    },
    {
        key: 'holdDurationSec',
        label: '보유시간',
        width: COL_WIDTHS.holdDurationSec,
        sortable: true,
        headerClassName: 'px-4 py-3 pr-8 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 pr-8 whitespace-nowrap text-right text-slate-700 dark:text-slate-300',
        render: (value) => formatHoldDuration(value),
        getFilterLabel: (v) => (v == null ? '(비어있음)' : formatHoldDuration(v)),
    }
];

/**
 * 코인 자동매매 거래기록 조회 페이지 (v2.2)
 * - 테이블 디자인 개선 (Sticky Header/Columns, Filter Row)
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
        tradeType: 'all',    // all, BUY, SELL
        reason: 'all'        // all, SIGNAL, TAKE_PROFIT, STOP_LOSS, EXPIRED
    });

    // 테이블 내부 필터/정렬
    const [columnFilters, setColumnFilters] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

    // 데이터
    const [records, setRecords] = useState([]);
    const [coinList, setCoinList] = useState([]);

    // 페이지네이션 (서버 사이드)
    const [currentPage, setCurrentPage] = useState(0); // 0-based for server
    const [itemsPerPage, setItemsPerPage] = useState(9999);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // 요약 정보
    const [summary, setSummary] = useState({
        buyCount: 0,
        buyAmount: 0,
        sellCount: 0,
        sellAmount: 0,
        winCount: 0,
        winRate: 0,
        totalProfit: 0,
        realizedProfitRate: 0,
        takeProfitCount: 0,
        stopLossCount: 0,
        trailingStopCount: 0,
        expiredCount: 0,
        maxHoldExpiredCount: 0,
        manualCount: 0,
        // 매도 사유별 손익 합계
        takeProfitAmount: 0,
        stopLossAmount: 0,
        trailingStopAmount: 0,
        expiredAmount: 0,
        maxHoldExpiredAmount: 0,
        manualAmount: 0,
        // 보유 종목 수익 정보
        holdingsProfit: 0,
        holdingsInvestment: 0,
        holdingsProfitRate: 0,
        holdingsCount: 0,
        // 합산 수익률
        combinedProfitRate: 0
    });

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
    }, []);

    // 종목 목록 조회
    const fetchCoinList = async () => {
        try {
            const { data, error } = await send('/dart/api/cointrade/coins', {}, 'GET');
            if (!error && data?.success && data?.response) {
                // 활성화된 종목만
                const activeCoins = data.response.filter(coin => coin.isActive);
                setCoinList(activeCoins);
            }
        } catch (e) {
            console.error('종목 목록 조회 실패:', e);
        }
    };

    // 거래기록 조회
    const handleSearch = async (page = 0, size = null) => {
        if (!filters.startDate || !filters.endDate) {
            setToast('조회 기간을 선택해주세요.');
            return;
        }

        const pageSize = size !== null ? size : itemsPerPage;

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

            if (filters.coinCode !== 'all') {
                params.append('coinCode', filters.coinCode);
            }
            if (filters.tradeType !== 'all') {
                params.append('tradeType', filters.tradeType);
            }
            if (filters.reason !== 'all') {
                params.append('reason', filters.reason);
            }

            const { data, error } = await send(`/dart/api/cointrade/history?${params.toString()}`, {}, 'GET');

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

                // 전체 보기(9999)일 때만 요약 계산 (페이징 시에는 전체 데이터가 아니므로 정확하지 않음)
                if (pageSize === 9999) {
                    calculateSummary(data.response.content);
                }
            }
        } catch (e) {
            console.error('거래기록 조회 실패:', e);
            setToast('조회 중 오류가 발생했습니다.');
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    // 요약 정보 계산
    const calculateSummary = async (data) => {
        const buyRecords = data.filter(r => r.tradeType === 'BUY');
        const sellRecords = data.filter(r => r.tradeType === 'SELL');

        const buyAmount = buyRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
        const sellAmount = sellRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
        const totalProfit = sellRecords.reduce((sum, r) => sum + (r.profitLoss || 0), 0);

        // 승률: 수익 매도(profitLoss > 0) 건수 / 전체 매도 건수
        const winCount = sellRecords.filter(r => (r.profitLoss || 0) > 0).length;
        const winRate = sellRecords.length > 0 ? (winCount / sellRecords.length * 100) : 0;

        // 실현 수익률: 매도 원금 = 매도금액 - 손익, 수익률 = 손익 / 원금 * 100
        const sellCostBasis = sellAmount - totalProfit;
        const realizedProfitRate = sellCostBasis > 0 ? (totalProfit / sellCostBasis * 100) : 0;

        // 사유별 분류 (카운트 + 손익 합계)
        const sumBy = (predicate) => {
            const filtered = sellRecords.filter(predicate);
            const amount = filtered.reduce((s, r) => s + (r.profitLoss || 0), 0);
            return { count: filtered.length, amount };
        };
        const takeProfit = sumBy(r => ['TAKE_PROFIT', 'PARTIAL_TAKE_PROFIT'].includes(r.reason));
        const stopLoss = sumBy(r => ['STOP_LOSS', 'PARTIAL_STOP_LOSS'].includes(r.reason));
        const trailingStop = sumBy(r => ['TRAILING_STOP', 'PARTIAL_TRAILING_STOP'].includes(r.reason));
        const expired = sumBy(r => ['EXPIRED'].includes(r.reason) || /^(PARTIAL_)?\d+DAY_PROFIT$/.test(r.reason));
        const maxHoldExpired = sumBy(r => ['MAX_HOLD_EXPIRED', 'MAX_HOLDING_EXPIRED'].includes(r.reason));
        const manual = sumBy(r => ['MANUAL', 'PARTIAL_MANUAL', 'MANUAL_CLEANUP', 'CLEANUP_NO_BALANCE'].includes(r.reason));

        const takeProfitCount = takeProfit.count;
        const stopLossCount = stopLoss.count;
        const trailingStopCount = trailingStop.count;
        const expiredCount = expired.count;
        const maxHoldExpiredCount = maxHoldExpired.count;
        const manualCount = manual.count;

        // 보유 종목 수익 정보 조회
        let holdingsProfit = 0;
        let holdingsInvestment = 0;
        let holdingsProfitRate = 0;
        let holdingsCount = 0;

        try {
            const holdingsResponse = await send('/dart/api/cointrade/holdings', {}, 'GET');
            if (holdingsResponse.data?.success && holdingsResponse.data?.response) {
                let holdingsData = holdingsResponse.data.response;
                holdingsCount = holdingsData.length;

                if (holdingsData.length > 0) {
                    // 현재가 조회 (업비트 API)
                    try {
                        const marketCodes = holdingsData.map(h => h.coinCode).join(',');
                        const tickerResponse = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);
                        if (tickerResponse.ok) {
                            const tickerData = await tickerResponse.json();
                            const tickerMap = {};
                            tickerData.forEach(t => { tickerMap[t.market] = t.trade_price; });

                            holdingsData = holdingsData.map(h => ({
                                ...h,
                                currentPrice: tickerMap[h.coinCode] || h.currentPrice
                            }));
                        }
                    } catch (tickerError) {
                        console.error('현재가 조회 실패:', tickerError);
                    }

                    holdingsInvestment = holdingsData.reduce((sum, h) => sum + (h.totalAmount || 0), 0);
                    const holdingsValuation = holdingsData.reduce((sum, h) => {
                        const valuation = h.currentPrice ? h.currentPrice * h.quantity : (h.totalAmount || 0);
                        return sum + valuation;
                    }, 0);
                    holdingsProfit = holdingsValuation - holdingsInvestment;
                    holdingsProfitRate = holdingsInvestment > 0 ? (holdingsProfit / holdingsInvestment * 100) : 0;
                }
            }
        } catch (e) {
            console.error('보유 종목 조회 실패:', e);
        }

        // 합산 수익률: 조회 기간 실현 손익 / 총 매수금액 * 100
        const combinedProfitRate = buyAmount > 0 ? (totalProfit / buyAmount * 100) : 0;

        setSummary({
            buyCount: buyRecords.length,
            buyAmount,
            sellCount: sellRecords.length,
            sellAmount,
            winCount,
            winRate,
            totalProfit,
            realizedProfitRate,
            takeProfitCount,
            stopLossCount,
            trailingStopCount,
            expiredCount,
            maxHoldExpiredCount,
            manualCount,
            takeProfitAmount: takeProfit.amount,
            stopLossAmount: stopLoss.amount,
            trailingStopAmount: trailingStop.amount,
            expiredAmount: expired.amount,
            maxHoldExpiredAmount: maxHoldExpired.amount,
            manualAmount: manual.amount,
            holdingsProfit,
            holdingsInvestment,
            holdingsProfitRate,
            holdingsCount,
            combinedProfitRate
        });
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

    // 컬럼별 전체 원본 값 (엑셀 필터 옵션용, records 변경 시에만 재계산)
    const columnValuesMap = useMemo(() => {
        const map = {};
        TABLE_COLUMNS.forEach(col => {
            map[col.key] = records.map(r => r[col.key]);
        });
        return map;
    }, [records]);

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

    // 요약 데이터를 행 배열로 변환
    const getSummaryRows = () => {
        const fmtAmount = (v) => `${v >= 0 ? '+' : ''}${Math.floor(v).toLocaleString()}원`;
        const fmtPct = (count) => summary.sellCount > 0
            ? `${(count / summary.sellCount * 100).toFixed(1)}%`
            : '0.0%';
        const reasonRows = [
            ['익절', summary.takeProfitCount, summary.takeProfitAmount],
            ['손절', summary.stopLossCount, summary.stopLossAmount],
            ['트레일링스탑', summary.trailingStopCount, summary.trailingStopAmount],
            ['강제청산', summary.maxHoldExpiredCount, summary.maxHoldExpiredAmount],
            ['수동매도', summary.manualCount, summary.manualAmount],
            ['만료매도', summary.expiredCount, summary.expiredAmount],
        ].flatMap(([label, count, amount]) => [
            [`${label} 건수`, `${count}건`],
            [`${label} 비율`, fmtPct(count)],
            [`${label} 손익`, count === 0 ? '-' : fmtAmount(amount)],
        ]);

        return [
            ['매수 건수', `${summary.buyCount}건`],
            ['매수 금액', `${Math.floor(summary.buyAmount).toLocaleString()}원`],
            ['매도 건수', `${summary.sellCount}건`],
            ['매도 금액', `${Math.floor(summary.sellAmount).toLocaleString()}원`],
            ['승률', `${summary.winRate.toFixed(1)}% (${summary.winCount}/${summary.sellCount}건)`],
            ['실현 손익', fmtAmount(summary.totalProfit)],
            ...reasonRows,
            ['실현 수익률', `${summary.realizedProfitRate >= 0 ? '+' : ''}${summary.realizedProfitRate.toFixed(2)}%`],
            ['보유 종목 수', `${summary.holdingsCount}종목`],
            ['보유 투자금', `${Math.floor(summary.holdingsInvestment).toLocaleString()}원`],
            ['보유 평가손익', fmtAmount(summary.holdingsProfit)],
            ['보유 수익률', `${summary.holdingsProfitRate >= 0 ? '+' : ''}${summary.holdingsProfitRate.toFixed(2)}%`],
            ['합산 수익률', `${summary.combinedProfitRate >= 0 ? '+' : ''}${summary.combinedProfitRate.toFixed(2)}%`],
        ];
    };

    // 거래 목록 → plain 값 행 배열 변환
    const getTradeRows = (data) => data.map(row => [
        row.createdAt ? formatDateTime(row.createdAt) : '-',
        row.coinCode || '-',
        row.tradeType === 'BUY' ? '매수' : '매도',
        row.price != null ? `${formatNumberWithComma(row.price)}원` : '-',
        row.quantity != null ? row.quantity.toFixed(8) : '-',
        row.totalAmount != null ? `${formatNumberWithComma(row.totalAmount)}원` : '-',
        row.reason ? getReasonLabel(row.reason) : '-',
        row.profitLoss != null ? `${row.profitLoss >= 0 ? '+' : ''}${formatNumberWithComma(row.profitLoss)}원` : '-',
        row.profitLossRate != null ? `${row.profitLossRate >= 0 ? '+' : ''}${row.profitLossRate.toFixed(2)}%` : '-',
        row.momentumScore != null ? Number(row.momentumScore).toFixed(4) : '-',
        row.mlConfidence != null ? `${(Number(row.mlConfidence) * 100).toFixed(1)}%` : '-',
        row.entryReason || '-',
        formatHoldDuration(row.holdDurationSec),
    ]);

    const TRADE_HEADERS = ['일시', '종목', '유형', '가격', '수량', '금액', '사유', '손익', '손익률', '모멘텀점수', 'ML확률', '진입사유', '보유시간'];

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

            ws.getColumn(1).width = 20;
            ws.getColumn(2).width = 25;

            const buf = await wb.xlsx.writeBuffer();
            triggerDownload(
                new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
                `코인거래_요약_${getTimestamp()}.xlsx`
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
                `코인거래_요약_${getTimestamp()}.csv`
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
            ws.addRow(TRADE_HEADERS);
            ws.getRow(1).eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
                cell.alignment = { horizontal: 'center' };
            });

            const rows = getTradeRows(processedData);
            rows.forEach(r => ws.addRow(r));

            // 열 너비 자동 조정
            const colWidths = [20, 14, 8, 16, 18, 16, 12, 16, 12, 12, 12];
            colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

            const buf = await wb.xlsx.writeBuffer();
            triggerDownload(
                new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
                `코인거래_목록_${getTimestamp()}.xlsx`
            );
        } catch (e) {
            console.error('거래목록 엑셀 다운로드 실패:', e);
            setToast('엑셀 다운로드에 실패했습니다.');
        }
    };

    const handleDownloadTradeCsv = () => {
        try {
            const csv = toCsv(TRADE_HEADERS, getTradeRows(processedData));
            triggerDownload(
                new Blob([csv], { type: 'text/csv;charset=utf-8' }),
                `코인거래_목록_${getTimestamp()}.csv`
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
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                                {selectedRecord.coinCode}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isBuy
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                }`}>
                                {isBuy ? '매수' : '매도'}
                            </span>
                            {!isBuy && selectedRecord.reason && (
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
                                    {renderFormattedPrice(selectedRecord.price, '원')}
                                </div>
                            </div>

                            {/* 수량 */}
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">수량</div>
                                <div className="text-base sm:text-lg text-slate-800 dark:text-slate-200">
                                    {selectedRecord.quantity ? renderFormattedNumber(selectedRecord.quantity, 8) : '-'}
                                </div>
                            </div>

                            {/* 총 금액 */}
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">총 금액</div>
                                <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
                                    {renderFormattedPrice(selectedRecord.totalAmount, '원')}
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
                                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800'
                                    : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                                    }`}>
                                    <div className={`text-xs mb-1 ${selectedRecord.profitLoss >= 0
                                        ? 'text-red-700 dark:text-red-400'
                                        : 'text-blue-700 dark:text-blue-400'
                                        }`}>
                                        손익금액
                                    </div>
                                    <div className={`text-xl sm:text-2xl font-bold ${selectedRecord.profitLoss >= 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-blue-600 dark:text-blue-400'
                                        }`}>
                                        {selectedRecord.profitLoss >= 0 ? '+' : ''}{renderFormattedPrice(selectedRecord.profitLoss, '원')}
                                    </div>
                                </div>

                                {/* 손익률 */}
                                <div className={`rounded-lg p-4 sm:p-5 ${selectedRecord.profitLossRate >= 0
                                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800'
                                    : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                                    }`}>
                                    <div className={`text-xs mb-1 ${selectedRecord.profitLossRate >= 0
                                        ? 'text-red-700 dark:text-red-400'
                                        : 'text-blue-700 dark:text-blue-400'
                                        }`}>
                                        손익률
                                    </div>
                                    <div className={`text-xl sm:text-2xl font-bold ${selectedRecord.profitLossRate >= 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-blue-600 dark:text-blue-400'
                                        }`}>
                                        {selectedRecord.profitLossRate >= 0 ? '+' : ''}{selectedRecord.profitLossRate.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 매수 진입 정보 (매수/매도 모두 - 매도는 보유 당시 진입 정보 유지) */}
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 rounded-lg p-4 sm:p-5 border border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">매수 진입 정보</h4>

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
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">진입 사유</div>
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
                                        <div className="text-xs text-red-600 dark:text-red-400 mb-1">에러 메시지</div>
                                        <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-2 rounded">
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
                                    {coinList.map(coin => (
                                        <option key={coin.coinCode} value={coin.coinCode}>
                                            {coin.coinCode} {coin.coinName && `(${coin.coinName})`}
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
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    매도 사유
                                </label>
                                <select
                                    value={filters.reason}
                                    onChange={(e) => handleFilterChange('reason', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">전체</option>
                                    <option value="SIGNAL">매수 (SIGNAL)</option>
                                    <option value="TAKE_PROFIT">익절 (TAKE_PROFIT)</option>
                                    <option value="STOP_LOSS">손절 (STOP_LOSS)</option>
                                    <option value="TRAILING_STOP">트레일링스탑 (TRAILING_STOP)</option>
                                    <option value="EXPIRED">만료 (EXPIRED)</option>
                                    <option value="MAX_HOLDING_EXPIRED">강제청산 (MAX_HOLDING_EXPIRED)</option>
                                </select>
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
                                {itemsPerPage !== 9999 && (
                                    <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                                        (전체 보기로 조회 시 정확한 요약을 확인할 수 있습니다)
                                    </span>
                                )}
                            </h2>
                            <div className="flex flex-wrap items-center gap-x-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                <span>{filters.startDate} {filters.startTime} ~ {filters.endDate} {filters.endTime}</span>
                                <span>·</span>
                                <span>{totalElements.toLocaleString()}건</span>
                                {(filters.tradeType !== 'all' || filters.coinCode !== 'all' || filters.reason !== 'all') && (
                                    <>
                                        <span>·</span>
                                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                                            필터 적용됨
                                            ({[
                                                filters.tradeType !== 'all' && (filters.tradeType === 'BUY' ? '매수' : '매도'),
                                                filters.coinCode !== 'all' && filters.coinCode,
                                                filters.reason !== 'all' && getReasonLabel(filters.reason)
                                            ].filter(Boolean).join(', ')})
                                            — 조회 조건에 해당하는 데이터만 집계
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        {itemsPerPage === 9999 && (
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

                    {itemsPerPage === 9999 ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                {/* 매수 건수 */}
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">매수 건수</div>
                                    <div className="text-xl font-bold text-blue-800 dark:text-blue-300">
                                        {summary.buyCount}건
                                    </div>
                                </div>

                                {/* 매수 금액 */}
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">매수 금액</div>
                                    <div className="text-lg font-bold text-blue-800 dark:text-blue-300">
                                        {formatNumberWithComma(Math.floor(summary.buyAmount))}원
                                    </div>
                                </div>

                                {/* 매도 건수 */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">매도 건수</div>
                                    <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                                        {summary.sellCount}건
                                    </div>
                                </div>

                                {/* 매도 금액 */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">매도 금액</div>
                                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                        {formatNumberWithComma(Math.floor(summary.sellAmount))}원
                                    </div>
                                </div>

                                {/* 승률 */}
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                                    <div className="text-xs text-amber-700 dark:text-amber-400 mb-1">승률</div>
                                    <div className="text-xl font-bold text-amber-800 dark:text-amber-300">
                                        {summary.winRate.toFixed(1)}%
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                        {summary.winCount} / {summary.sellCount}건
                                    </div>
                                </div>

                                {/* 실현 손익 */}
                                <div className={`p-4 rounded-lg ${summary.totalProfit >= 0 ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'}`}>
                                    <div className={`text-xs mb-1 ${summary.totalProfit >= 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>실현 손익</div>
                                    <div className={`text-lg font-bold ${summary.totalProfit >= 0 ? 'text-red-800 dark:text-red-300' : 'text-blue-800 dark:text-blue-300'}`}>
                                        {summary.totalProfit >= 0 ? '+' : ''}{formatNumberWithComma(Math.floor(summary.totalProfit))}원
                                    </div>
                                </div>
                            </div>

                            {/* 매도 사유별 건수 */}
                            <div className="mt-4">
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                                    매도 사유별 건수 · 비율 · 손익
                                    <span className="ml-2 font-normal text-[10px] text-slate-400 dark:text-slate-500">
                                        (비율은 전체 매도 {summary.sellCount}건 대비)
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    {[
                                        { label: '익절', count: summary.takeProfitCount, amount: summary.takeProfitAmount,
                                          bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-100 dark:border-green-800',
                                          labelColor: 'text-green-700 dark:text-green-400', valueColor: 'text-green-800 dark:text-green-300' },
                                        { label: '손절', count: summary.stopLossCount, amount: summary.stopLossAmount,
                                          bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-800',
                                          labelColor: 'text-red-700 dark:text-red-400', valueColor: 'text-red-800 dark:text-red-300' },
                                        { label: '트레일링스탑', count: summary.trailingStopCount, amount: summary.trailingStopAmount,
                                          bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-100 dark:border-teal-800',
                                          labelColor: 'text-teal-700 dark:text-teal-400', valueColor: 'text-teal-800 dark:text-teal-300' },
                                        { label: '강제청산', count: summary.maxHoldExpiredCount, amount: summary.maxHoldExpiredAmount,
                                          bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800',
                                          labelColor: 'text-amber-700 dark:text-amber-400', valueColor: 'text-amber-800 dark:text-amber-300' },
                                        { label: '수동매도', count: summary.manualCount, amount: summary.manualAmount,
                                          bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-100 dark:border-orange-800',
                                          labelColor: 'text-orange-700 dark:text-orange-400', valueColor: 'text-orange-800 dark:text-orange-300' },
                                        { label: '만료매도', count: summary.expiredCount, amount: summary.expiredAmount,
                                          bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-100 dark:border-purple-800',
                                          labelColor: 'text-purple-700 dark:text-purple-400', valueColor: 'text-purple-800 dark:text-purple-300' },
                                    ].map(({ label, count, amount, bg, border, labelColor, valueColor }) => {
                                        const pct = summary.sellCount > 0 ? (count / summary.sellCount * 100) : 0;
                                        const profitClass = amount >= 0
                                            ? 'text-red-700 dark:text-red-400'
                                            : 'text-blue-700 dark:text-blue-400';
                                        return (
                                            <div key={label} className={`p-4 rounded-lg border ${bg} ${border}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs ${labelColor}`}>{label}</span>
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-900/40 ${labelColor}`}>
                                                        {pct.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className={`text-xl font-bold ${valueColor}`}>
                                                    {count}건
                                                </div>
                                                <div className={`text-xs mt-1 font-medium ${profitClass}`}>
                                                    {count === 0 ? (
                                                        <span className="text-slate-400 dark:text-slate-500">-</span>
                                                    ) : (
                                                        <>{amount >= 0 ? '+' : ''}{formatNumberWithComma(Math.floor(amount))}원</>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 수익률 요약 */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                {/* 실현 수익률 */}
                                <div className={`p-4 rounded-lg border ${summary.realizedProfitRate >= 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'}`}>
                                    <div className={`text-xs mb-1 ${summary.realizedProfitRate >= 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                        실현 수익률
                                    </div>
                                    <div className={`text-xl font-bold ${summary.realizedProfitRate >= 0 ? 'text-red-800 dark:text-red-300' : 'text-blue-800 dark:text-blue-300'}`}>
                                        {summary.realizedProfitRate >= 0 ? '+' : ''}{summary.realizedProfitRate.toFixed(2)}%
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                        매도 실현 손익 / 매도 원금
                                    </div>
                                </div>

                                {/* 보유 종목 수익률 */}
                                <div className={`p-4 rounded-lg border ${summary.holdingsProfitRate >= 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'}`}>
                                    <div className={`text-xs mb-1 ${summary.holdingsProfitRate >= 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                        보유 수익률 ({summary.holdingsCount}종목)
                                    </div>
                                    <div className={`text-xl font-bold ${summary.holdingsProfitRate >= 0 ? 'text-red-800 dark:text-red-300' : 'text-blue-800 dark:text-blue-300'}`}>
                                        {summary.holdingsProfitRate >= 0 ? '+' : ''}{summary.holdingsProfitRate.toFixed(2)}%
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                        평가손익: {summary.holdingsProfit >= 0 ? '+' : ''}{formatNumberWithComma(Math.floor(summary.holdingsProfit))}원
                                    </div>
                                </div>

                                {/* 합산 수익률 */}
                                <div className={`p-4 rounded-lg border-2 ${summary.combinedProfitRate >= 0 ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700' : 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'}`}>
                                    <div className={`text-xs mb-1 font-semibold ${summary.combinedProfitRate >= 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                        합산 수익률
                                    </div>
                                    <div className={`text-2xl font-bold ${summary.combinedProfitRate >= 0 ? 'text-red-800 dark:text-red-300' : 'text-blue-800 dark:text-blue-300'}`}>
                                        {summary.combinedProfitRate >= 0 ? '+' : ''}{summary.combinedProfitRate.toFixed(2)}%
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                        (실현 + 보유 평가) / 총 투자금
                                    </div>
                                </div>
                            </div>

                        </>
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
                            <option value={9999}>전체 보기</option>
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
                                {itemsPerPage === 9999
                                    ? `전체 ${totalElements.toLocaleString()}건`
                                    : `${currentPage * itemsPerPage + 1}-${Math.min((currentPage + 1) * itemsPerPage, totalElements)} / 총 ${totalElements.toLocaleString()}건`}
                            </span>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto scrollbar-always bg-white border border-slate-200 rounded-lg shadow-sm max-h-[70vh] dark:bg-slate-800 dark:border-slate-700" style={{ scrollbarGutter: 'stable' }}>
                  <div style={{ minWidth: '1200px' }}>
                    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                        <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-700 to-slate-600 text-white">
                            <tr>
                                {TABLE_COLUMNS.map((col, index) => {
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
                                                    getOptionLabel={col.getFilterLabel}
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
                                    <td colSpan={TABLE_COLUMNS.length} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                                        데이터를 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : currentRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={TABLE_COLUMNS.length} className="px-4 py-12 text-center">
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
                                        {TABLE_COLUMNS.map((col, index) => {
                                            const value = row[col.key];
                                            const displayValue = col.render ? col.render(value) : (value ?? '-');

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
                periodLabel={`${filters.startDate} ${filters.startTime} ~ ${filters.endDate} ${filters.endTime}`}
            />
        </div>
    );
}