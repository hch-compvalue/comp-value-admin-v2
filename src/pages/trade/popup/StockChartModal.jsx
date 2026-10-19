import { useState, useEffect, useRef, useMemo } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';
import {
    ComposedChart, Line, BarChart, Bar, Cell, ReferenceArea,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fetchStockPriceVolume } from '@/util/ChartApi';
import {
    calcSMA, calcEMA, calcBollingerBands, calcRSI, calcMACD, calcStochastic, getMaxLookback,
} from '@/util/technicalIndicators';
import { SLATE } from '@/config/themeColors';

// 기간 옵션
const PERIOD_OPTIONS = [
    { value: 7, label: '7일' },
    { value: 30, label: '30일' },
    { value: 90, label: '3개월' },
    { value: 180, label: '6개월' },
    { value: 365, label: '1년' },
    { value: 1095, label: '3년' },
    { value: 1825, label: '5년' },
    { value: 3650, label: '10년' },
];

// 지표 정의
const OVERLAY_INDICATORS = [
    {
        key: 'sma20', label: 'SMA 20', color: '#f59e0b',
        desc: '최근 20일 종가의 평균선 (단기)',
        tip: '주가가 이 선 위에 있으면 단기 상승 추세, 아래면 하락 추세. 이 선이 지지선/저항선 역할을 자주 함',
    },
    {
        key: 'sma50', label: 'SMA 50', color: '#10b981',
        desc: '최근 50일 종가의 평균선 (중기)',
        tip: 'SMA 20이 SMA 50을 위로 뚫으면 "골든크로스"(매수 신호), 아래로 뚫으면 "데드크로스"(매도 신호)',
    },
    {
        key: 'sma200', label: 'SMA 200', color: '#ef4444',
        desc: '최근 200일 종가의 평균선 (장기)',
        tip: '투자자들이 가장 많이 보는 장기 지표. 주가가 이 선 위면 장기 상승장, 아래면 장기 하락장으로 판단',
    },
    {
        key: 'ema12', label: 'EMA 12', color: '#8b5cf6',
        desc: '12일 지수이동평균 (최근 가격에 가중치)',
        tip: 'SMA보다 최근 움직임에 민감하게 반응. EMA 12가 EMA 26 위에 있으면 상승세',
    },
    {
        key: 'ema26', label: 'EMA 26', color: '#ec4899',
        desc: '26일 지수이동평균',
        tip: 'EMA 12와 함께 사용. 두 선의 간격이 벌어지면 추세가 강하고, 좁아지면 추세 전환 가능성',
    },
    {
        key: 'bollinger', label: '볼린저', color: '#6366f1',
        desc: '중심선(SMA 20) + 상단/하단 밴드 (표준편차 2배)',
        tip: '밴드 폭이 좁아지면 큰 움직임 예고. 주가가 상단 밴드 터치 → 과매수, 하단 밴드 터치 → 과매도 가능성',
    },
];

const OSCILLATOR_INDICATORS = [
    {
        key: 'rsi', label: 'RSI',
        desc: '가격의 상승/하락 강도를 0~100으로 표시',
        tip: '70 이상 → 과매수(너무 올라서 조정 가능성)\n30 이하 → 과매도(너무 내려서 반등 가능성)\n50 근처 → 중립',
    },
    {
        key: 'macd', label: 'MACD',
        desc: '두 이동평균의 차이로 추세 변화를 포착',
        tip: '파란선이 빨간선 위로 교차 → 매수 타이밍\n파란선이 빨간선 아래로 교차 → 매도 타이밍\n히스토그램: 초록 막대=상승세 강화, 빨강 막대=하락세 강화',
    },
    {
        key: 'stochastic', label: '스토캐스틱',
        desc: '일정 기간 내 현재 가격의 상대적 위치 (0~100)',
        tip: '80 이상 → 과매수 구간 (고점 근처)\n20 이하 → 과매도 구간 (저점 근처)\n%K가 %D를 위로 교차 → 매수, 아래로 교차 → 매도',
    },
];

const DEFAULT_INDICATORS = {
    sma20: false, sma50: false, sma200: false,
    ema12: false, ema26: false,
    bollinger: false,
    rsi: false, macd: false, stochastic: false,
};

// 공통 XAxis 날짜 포매터
const dateTickFormatter = (date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
};

// 공통 Tooltip 날짜 포매터
const dateLabelFormatter = (date) =>
    new Date(date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

// 공통 Tooltip 스타일
const tooltipStyle = {
    backgroundColor: 'white',
    border: '1px solid var(--color-slate-200)',
    borderRadius: '8px',
    fontSize: '12px',
    padding: '8px 12px',
};

/**
 * 주식 가격 및 거래량 차트 모달
 */
const StockChartModal = ({ isOpen, onClose, symbol, companyName, zIndex = 140 }) => {

    const [rawData, setRawData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState(30);
    const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);

    // 활성 지표 중 가장 긴 lookback
    const maxLookback = useMemo(() => getMaxLookback(indicators), [indicators]);

    // 실제 API 요청 기간 (표시 기간 + lookback 여유분)
    const fetchDays = useMemo(() => {
        // 주말/공휴일 보정: 거래일 기준 약 1.5배
        return period + Math.ceil(maxLookback * 1.5);
    }, [period, maxLookback]);

    // 이미 fetch한 일수 추적 — 지표 토글 시 불필요한 재요청 방지
    const fetchedDaysRef = useRef(0);
    const prevPeriodRef = useRef(period);
    const prevSymbolRef = useRef(symbol);

    useEffect(() => {
        if (!isOpen || !symbol) return;

        // 모달 열림, 심볼 변경, 기간 변경 → 전체 로딩
        const needFullReload =
            prevSymbolRef.current !== symbol ||
            prevPeriodRef.current !== period ||
            rawData.length === 0;

        prevPeriodRef.current = period;
        prevSymbolRef.current = symbol;

        if (needFullReload) {
            fetchedDaysRef.current = 0;
            loadChartData(true);
            return;
        }

        // 지표 토글로 인한 fetchDays 증가 → 이미 충분하면 skip
        if (fetchedDaysRef.current >= fetchDays) return;

        // 추가 데이터 필요 → 기존 차트 유지한 채 백그라운드 fetch
        loadChartData(false);
    }, [isOpen, symbol, fetchDays]);

    const loadChartData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        setError(null);

        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - fetchDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        try {
            const result = await fetchStockPriceVolume(symbol, from, to);

            if (result.error) {
                setError(result.error);
                return;
            }

            if (result.data?.success && result.data?.response) {
                const sortedData = [...result.data.response].sort((a, b) =>
                    new Date(a.date) - new Date(b.date)
                );
                setRawData(sortedData);
                fetchedDaysRef.current = fetchDays;
            } else {
                setError('차트 데이터를 불러올 수 없습니다.');
            }
        } catch (err) {
            setError('차트 데이터 조회 중 오류가 발생했습니다.');
            console.error(err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    // 지표 계산 + 표시 기간으로 slice
    const enrichedData = useMemo(() => {
        if (rawData.length === 0) return [];

        let result = rawData;

        // 오버레이 지표
        if (indicators.sma20) result = calcSMA(result, 20);
        if (indicators.sma50) result = calcSMA(result, 50);
        if (indicators.sma200) result = calcSMA(result, 200);
        if (indicators.ema12) result = calcEMA(result, 12);
        if (indicators.ema26) result = calcEMA(result, 26);
        if (indicators.bollinger) result = calcBollingerBands(result, 20, 2);

        // 오실레이터 지표
        if (indicators.rsi) result = calcRSI(result, 14);
        if (indicators.macd) result = calcMACD(result, 12, 26, 9);
        if (indicators.stochastic) result = calcStochastic(result, 14, 3);

        // 항상 표시 기간의 시작 날짜 기준으로 필터 (달력 일수 기준)
        const displayFrom = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
        result = result.filter(d => new Date(d.date) >= displayFrom);

        return result;
    }, [rawData, indicators, period, maxLookback]);

    // 지표 토글
    const toggleIndicator = (key) => {
        setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // --- 드래그 줌 ---
    const [zoomDates, setZoomDates] = useState(null);
    const [refAreaLeft, setRefAreaLeft] = useState(null);
    const [refAreaRight, setRefAreaRight] = useState(null);
    const isDragging = useRef(false);

    // 줌 적용된 데이터 (모든 차트에서 공유)
    const zoomedData = useMemo(() => {
        if (!zoomDates) return enrichedData;
        return enrichedData.filter(d => d.date >= zoomDates.left && d.date <= zoomDates.right);
    }, [enrichedData, zoomDates]);

    const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const handleChartMouseDown = (e) => {
        if (isTouchDevice()) return;
        if (e?.activeLabel) {
            setRefAreaLeft(e.activeLabel);
            isDragging.current = true;
        }
    };
    const handleChartMouseMove = (e) => {
        if (isDragging.current && e?.activeLabel) {
            setRefAreaRight(e.activeLabel);
        }
    };
    const handleChartMouseUp = () => {
        if (!isDragging.current || !refAreaLeft || !refAreaRight) {
            isDragging.current = false;
            setRefAreaLeft(null);
            setRefAreaRight(null);
            return;
        }
        isDragging.current = false;

        let left = refAreaLeft;
        let right = refAreaRight;
        if (left > right) [left, right] = [right, left];

        if (left !== right) {
            setZoomDates({ left, right });
        }
        setRefAreaLeft(null);
        setRefAreaRight(null);
    };
    const resetZoom = () => setZoomDates(null);

    // 기간 변경 시 줌 리셋
    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        setZoomDates(null);
    };

    // ESC 키로 닫기
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    if (!shouldRender) return null;

    const chartData = enrichedData;
    const latestData = chartData[chartData.length - 1];
    const previousData = chartData[chartData.length - 2];
    const change = latestData && previousData ? latestData.close - previousData.close : 0;
    const changePercent = latestData && previousData && previousData.close !== 0
        ? ((change / previousData.close) * 100)
        : 0;
    const isPositive = change >= 0;

    const periodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label || `${period}일`;

    return (
        <>
            {/* 배경 오버레이 */}
            <div className={`fixed inset-0 bg-black/50 dark:bg-black/70 z-[120] animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }} onClick={onClose} />

            {/* 모달 */}
            <div
                className={`fixed z-[130] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-xl rounded-lg max-h-[85vh] w-[min(1000px,90vw)] overflow-auto dark:bg-slate-800 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`}
                style={{ zIndex: zIndex, animationDuration: '0.25s' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="sticky top-0 z-10 px-5 py-4 border-b bg-white dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                                    {companyName || symbol}
                                </h2>
                                <span className="text-sm text-slate-500 dark:text-slate-400">{symbol}</span>
                            </div>
                            {latestData && (
                                <div className="flex items-baseline gap-3 mt-1">
                                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                                        ${latestData.close.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </span>
                                    <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                        }`}>
                                        <span>{isPositive ? '▲' : '▼'}</span>
                                        <span>{isPositive ? '+' : '-'}{Math.abs(change).toFixed(2)}</span>
                                        <span>({isPositive ? '+' : '-'}{Math.abs(changePercent).toFixed(2)}%)</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            className="text-sm px-3 py-2 border rounded hover:bg-gray-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            onClick={onClose}
                        >
                            닫기 (Esc)
                        </button>
                    </div>
                    {/* 기간 선택 */}
                    <div className="w-full sm:w-auto overflow-x-auto scrollbar-always min-w-0 p-0 m-0 border-none">
                        <PeriodSelector period={period} onChange={handlePeriodChange} disabled={loading} />
                    </div>
                    {/* 지표 토글 */}
                    <IndicatorToggle indicators={indicators} onToggle={toggleIndicator} />
                </div>

                {/* 콘텐츠 */}
                <div className="p-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-slate-500 dark:text-slate-400">차트 데이터를 불러오는 중...</div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-slate-500 dark:text-slate-400">차트 데이터가 없습니다.</div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* 가격 차트 */}
                            <div className="bg-white rounded-lg border p-4 dark:bg-slate-700 dark:border-slate-600">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        주식 가격 (최근 {periodLabel})
                                        {zoomDates && <span className="ml-2 text-xs font-normal text-blue-500">줌 적용중</span>}
                                    </h3>
                                    {zoomDates && (
                                        <button
                                            onClick={resetZoom}
                                            className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors dark:text-blue-400 dark:border-blue-500 dark:hover:bg-slate-600"
                                        >
                                            줌 리셋
                                        </button>
                                    )}
                                    {!zoomDates && (
                                        <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">드래그하여 확대</span>
                                    )}
                                </div>
                                <ResponsiveContainer width="100%" height={300} className="select-none">
                                    <ComposedChart
                                        data={zoomedData}
                                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                                        onMouseDown={handleChartMouseDown}
                                        onMouseMove={handleChartMouseMove}
                                        onMouseUp={handleChartMouseUp}
                                        onDoubleClick={resetZoom}
                                        style={{ cursor: 'crosshair', userSelect: 'none' }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke={SLATE[100]} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fill: SLATE[500] }}
                                            tickFormatter={dateTickFormatter}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11, fill: SLATE[500] }}
                                            domain={['dataMin - 5', 'dataMax + 5']}
                                            tickFormatter={(value) => `$${value.toFixed(0)}`}
                                        />
                                        <Tooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value, name) => {
                                                if (value === null || value === undefined) return ['-', name];
                                                const fmt = `$${Number(value).toFixed(2)}`;
                                                const labels = {
                                                    close: '종가', high: '고가', low: '저가', open: '시가',
                                                    sma20: 'SMA 20', sma50: 'SMA 50', sma200: 'SMA 200',
                                                    ema12: 'EMA 12', ema26: 'EMA 26',
                                                    bbUpper: 'BB 상단', bbMiddle: 'BB 중간', bbLower: 'BB 하단',
                                                };
                                                return [fmt, labels[name] || name];
                                            }}
                                            labelFormatter={dateLabelFormatter}
                                        />

                                        {/* 고가/저가 */}
                                        <Line type="monotone" dataKey="high" stroke={SLATE[400]} strokeWidth={1} dot={false} strokeDasharray="3 3" />
                                        <Line type="monotone" dataKey="low" stroke={SLATE[400]} strokeWidth={1} dot={false} strokeDasharray="3 3" />

                                        {/* 종가 */}
                                        <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />

                                        {/* SMA */}
                                        {indicators.sma20 && (
                                            <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                                        )}
                                        {indicators.sma50 && (
                                            <Line type="monotone" dataKey="sma50" stroke="#10b981" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                                        )}
                                        {indicators.sma200 && (
                                            <Line type="monotone" dataKey="sma200" stroke="#ef4444" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                                        )}

                                        {/* EMA */}
                                        {indicators.ema12 && (
                                            <Line type="monotone" dataKey="ema12" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="5 3" connectNulls={false} isAnimationActive={false} />
                                        )}
                                        {indicators.ema26 && (
                                            <Line type="monotone" dataKey="ema26" stroke="#ec4899" strokeWidth={1.5} dot={false} strokeDasharray="5 3" connectNulls={false} isAnimationActive={false} />
                                        )}

                                        {/* 볼린저 밴드 선 */}
                                        {indicators.bollinger && <Line type="monotone" dataKey="bbUpper" stroke="#6366f1" strokeWidth={1} dot={false} strokeDasharray="4 2" connectNulls={false} isAnimationActive={false} />}
                                        {indicators.bollinger && <Line type="monotone" dataKey="bbMiddle" stroke="#6366f1" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />}
                                        {indicators.bollinger && <Line type="monotone" dataKey="bbLower" stroke="#6366f1" strokeWidth={1} dot={false} strokeDasharray="4 2" connectNulls={false} isAnimationActive={false} />}

                                        {/* 드래그 선택 영역 */}
                                        {refAreaLeft && refAreaRight && (
                                            <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.15} />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                                {/* 범례 */}
                                <PriceChartLegend indicators={indicators} />
                            </div>

                            {/* 거래량 차트 */}
                            <div className="bg-white rounded-lg border p-4 dark:bg-slate-700 dark:border-slate-600">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3 dark:text-slate-200">거래량</h3>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={zoomedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={SLATE[100]} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fill: SLATE[500] }}
                                            tickFormatter={dateTickFormatter}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11, fill: SLATE[500] }}
                                            tickFormatter={(value) => {
                                                if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
                                                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                                if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                                                return value;
                                            }}
                                        />
                                        <Tooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value) => [value.toLocaleString(), '거래량']}
                                            labelFormatter={dateLabelFormatter}
                                        />
                                        <Bar dataKey="volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* RSI 패널 */}
                            {indicators.rsi && (
                                <div className="bg-white rounded-lg border p-4 dark:bg-slate-700 dark:border-slate-600">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3 dark:text-slate-200">RSI (14)</h3>
                                    <ResponsiveContainer width="100%" height={120}>
                                        <ComposedChart data={zoomedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={SLATE[100]} />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 11, fill: SLATE[500] }}
                                                tickFormatter={dateTickFormatter}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: SLATE[500] }}
                                                domain={[0, 100]}
                                                ticks={[0, 30, 50, 70, 100]}
                                            />
                                            <Tooltip
                                                contentStyle={tooltipStyle}
                                                formatter={(value) => [value !== null ? value.toFixed(2) : '-', 'RSI']}
                                                labelFormatter={dateLabelFormatter}
                                            />
                                            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.7} />
                                            <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.7} />
                                            <Line type="monotone" dataKey="rsi" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                    <div className="flex justify-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="text-red-500">--- 과매수 (70)</span>
                                        <span className="text-emerald-500">--- 과매도 (30)</span>
                                    </div>
                                </div>
                            )}

                            {/* MACD 패널 */}
                            {indicators.macd && (
                                <div className="bg-white rounded-lg border p-4 dark:bg-slate-700 dark:border-slate-600">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3 dark:text-slate-200">MACD (12, 26, 9)</h3>
                                    <ResponsiveContainer width="100%" height={150}>
                                        <ComposedChart data={zoomedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={SLATE[100]} />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 11, fill: SLATE[500] }}
                                                tickFormatter={dateTickFormatter}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis tick={{ fontSize: 11, fill: SLATE[500] }} />
                                            <Tooltip
                                                contentStyle={tooltipStyle}
                                                formatter={(value, name) => {
                                                    if (value === null || value === undefined) return ['-', name];
                                                    const labels = { macd: 'MACD', macdSignal: '시그널', macdHist: '히스토그램' };
                                                    return [Number(value).toFixed(4), labels[name] || name];
                                                }}
                                                labelFormatter={dateLabelFormatter}
                                            />
                                            <ReferenceLine y={0} stroke={SLATE[400]} strokeWidth={1} />
                                            <Bar dataKey="macdHist" isAnimationActive={false}>
                                                {zoomedData.map((entry, index) => (
                                                    <Cell key={index} fill={entry.macdHist >= 0 ? '#10b981' : '#ef4444'} />
                                                ))}
                                            </Bar>
                                            <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                                            <Line type="monotone" dataKey="macdSignal" stroke="#ef4444" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                    <div className="flex justify-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-0.5 bg-blue-500"></div>
                                            <span>MACD</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-0.5 bg-red-500"></div>
                                            <span>시그널</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-1.5 bg-emerald-500/50"></div>
                                            <span>히스토그램</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 스토캐스틱 패널 */}
                            {indicators.stochastic && (
                                <div className="bg-white rounded-lg border p-4 dark:bg-slate-700 dark:border-slate-600">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3 dark:text-slate-200">스토캐스틱 (14, 3)</h3>
                                    <ResponsiveContainer width="100%" height={120}>
                                        <ComposedChart data={zoomedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={SLATE[100]} />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 11, fill: SLATE[500] }}
                                                tickFormatter={dateTickFormatter}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: SLATE[500] }}
                                                domain={[0, 100]}
                                                ticks={[0, 20, 50, 80, 100]}
                                            />
                                            <Tooltip
                                                contentStyle={tooltipStyle}
                                                formatter={(value, name) => {
                                                    if (value === null || value === undefined) return ['-', name];
                                                    const labels = { stochK: '%K', stochD: '%D' };
                                                    return [Number(value).toFixed(2), labels[name] || name];
                                                }}
                                                labelFormatter={dateLabelFormatter}
                                            />
                                            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.7} />
                                            <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.7} />
                                            <Line type="monotone" dataKey="stochK" stroke="#3b82f6" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                                            <Line type="monotone" dataKey="stochD" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="5 3" connectNulls={false} isAnimationActive={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                    <div className="flex justify-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-0.5 bg-blue-500"></div>
                                            <span>%K</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-0.5 bg-red-500 border-dashed border-t"></div>
                                            <span>%D</span>
                                        </div>
                                        <span className="text-red-500">--- 과매수 (80)</span>
                                        <span className="text-emerald-500">--- 과매도 (20)</span>
                                    </div>
                                </div>
                            )}

                            {/* 최근 데이터 요약 */}
                            {latestData && (
                                <div className="bg-slate-50 rounded-lg border p-4 dark:bg-slate-700/50 dark:border-slate-600">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3 dark:text-slate-200">
                                        최근 데이터 ({new Date(latestData.date).toLocaleDateString('ko-KR')})
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        <DataItem label="시가" value={`$${latestData.open.toFixed(2)}`} />
                                        <DataItem label="고가" value={`$${latestData.high.toFixed(2)}`} />
                                        <DataItem label="저가" value={`$${latestData.low.toFixed(2)}`} />
                                        <DataItem label="종가" value={`$${latestData.close.toFixed(2)}`} />
                                        <DataItem label="거래량" value={latestData.volume.toLocaleString()} />
                                        <DataItem label="VWAP" value={`$${latestData.vwap.toFixed(2)}`} />
                                        <DataItem
                                            label="변동"
                                            value={`${latestData.change >= 0 ? '+' : ''}${latestData.change.toFixed(2)}`}
                                            valueClassName={latestData.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                                        />
                                        <DataItem
                                            label="변동률"
                                            value={`${latestData.changePercent >= 0 ? '+' : ''}${latestData.changePercent.toFixed(2)}%`}
                                            valueClassName={latestData.changePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

/**
 * 지표 토글 컴포넌트
 */
const IndicatorToggle = ({ indicators, onToggle }) => {
    const [showHelp, setShowHelp] = useState(false);

    return (
        <div className="mt-3 text-xs">
            <div className="flex flex-col sm:flex-row gap-2">
                {/* 오버레이 그룹 */}
                <div className="flex flex-wrap items-center gap-1">
                    <span className="text-slate-500 dark:text-slate-400 mr-1 font-medium">오버레이</span>
                    {OVERLAY_INDICATORS.map(ind => (
                        <button
                            key={ind.key}
                            onClick={() => onToggle(ind.key)}
                            className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                                indicators[ind.key]
                                    ? 'text-white border-transparent'
                                    : 'text-slate-600 border-slate-300 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'
                            }`}
                            style={indicators[ind.key] ? { backgroundColor: ind.color } : {}}
                        >
                            {ind.label}
                        </button>
                    ))}
                </div>
                {/* 구분선 */}
                <div className="hidden sm:block w-px bg-slate-300 dark:bg-slate-600 mx-1" />
                {/* 오실레이터 그룹 */}
                <div className="flex flex-wrap items-center gap-1">
                    <span className="text-slate-500 dark:text-slate-400 mr-1 font-medium">오실레이터</span>
                    {OSCILLATOR_INDICATORS.map(ind => (
                        <button
                            key={ind.key}
                            onClick={() => onToggle(ind.key)}
                            className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                                indicators[ind.key]
                                    ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                                    : 'text-slate-600 border-slate-300 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'
                            }`}
                        >
                            {ind.label}
                        </button>
                    ))}
                </div>
                {/* 도움말 토글 */}
                <button
                    onClick={() => setShowHelp(prev => !prev)}
                    className={`ml-auto px-2 py-1 rounded border text-xs font-medium transition-colors ${
                        showHelp
                            ? 'bg-slate-600 text-white border-slate-600 dark:bg-slate-500 dark:border-slate-500'
                            : 'text-slate-500 border-slate-300 hover:bg-slate-100 dark:text-slate-400 dark:border-slate-600 dark:hover:bg-slate-700'
                    }`}
                >
                    ? 설명
                </button>
            </div>
            {/* 지표 설명 패널 */}
            {showHelp && (
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-700/50 dark:border-slate-600 overflow-hidden">
                    {/* 오버레이 섹션 */}
                    <HelpSection
                        title="오버레이 지표"
                        subtitle="가격 차트 위에 겹쳐서 표시"
                        items={OVERLAY_INDICATORS}
                        columns={2}
                    />
                    {/* 오실레이터 섹션 */}
                    <HelpSection
                        title="오실레이터 지표"
                        subtitle="가격 차트 아래에 별도 패널로 표시"
                        items={OSCILLATOR_INDICATORS}
                        columns={1}
                        defaultColor="#3b82f6"
                    />
                </div>
            )}
        </div>
    );
};

/**
 * 설명 섹션 (아코디언)
 */
const HelpSection = ({ title, subtitle, items, columns = 1, defaultColor }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-b last:border-b-0 border-slate-200 dark:border-slate-600">
            <button
                onClick={() => setOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-600/50 transition-colors"
            >
                <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">{title}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</span>
                </div>
                <span className={`text-slate-400 dark:text-slate-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>
            {open && (
                <div className={`px-3 pb-3 grid gap-2 ${columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    {items.map(ind => (
                        <div key={ind.key} className="rounded-md border border-slate-200 dark:border-slate-600 p-2 bg-white dark:bg-slate-700">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: ind.color || defaultColor }}
                                />
                                <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">{ind.label}</span>
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">{ind.desc}</span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 pl-4 leading-relaxed whitespace-pre-line">{ind.tip}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * 가격 차트 범례
 */
const PriceChartLegend = ({ indicators }) => {
    const items = [
        { color: '#3b82f6', label: '종가', show: true },
        { color: SLATE[400], label: '고가/저가', show: true, dashed: true },
    ];

    OVERLAY_INDICATORS.forEach(ind => {
        if (indicators[ind.key]) {
            items.push({
                color: ind.color,
                label: ind.label,
                show: true,
                dashed: ind.key.startsWith('ema'),
            });
        }
    });

    return (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-600 dark:text-slate-400">
            {items.filter(i => i.show).map((item, idx) => (
                <div key={idx} className="flex items-center gap-1">
                    <div
                        className="w-3 h-0.5"
                        style={{
                            backgroundColor: item.color,
                            borderTop: item.dashed ? `1px dashed ${item.color}` : 'none',
                        }}
                    />
                    <span>{item.label}</span>
                </div>
            ))}
        </div>
    );
};

/**
 * 기간 선택 컴포넌트
 */
const PeriodSelector = ({ period, onChange, disabled }) => {
    const buttonRefs = useRef({});

    useEffect(() => {
        if (buttonRefs.current[period]) {
            buttonRefs.current[period].scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest',
            });
        }
    }, [period]);

    return (
        <div className="inline-flex whitespace-nowrap gap-1 min-w-0 pl-2 pr-2">
            {PERIOD_OPTIONS.map(option => (
                <button
                    key={option.value}
                    ref={el => (buttonRefs.current[option.value] = el)}
                    onClick={() => onChange(option.value)}
                    disabled={disabled}
                    className={`flex-shrink-0 md:px-3 px-2 py-1.5 text-xs font-medium rounded transition-colors ${period === option.value
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ minWidth: 48 }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};

/**
 * 데이터 아이템 컴포넌트
 */
const DataItem = ({ label, value, valueClassName = '' }) => (
    <div>
        <div className="text-slate-500 mb-1 dark:text-slate-400">{label}</div>
        <div className={`font-semibold ${valueClassName || 'dark:text-slate-200'}`}>{value}</div>
    </div>
);

export default StockChartModal;
