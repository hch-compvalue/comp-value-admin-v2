import { useState, useEffect, useRef, useMemo } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';
import {
    ComposedChart, Line, BarChart, Bar, Cell, ReferenceArea,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fetchStockPriceVolume } from '@/util/ChartApi';
import {
    calcSMA, calcEMA, calcBollingerBands, calcRSI, calcMACD, calcStochastic, getMaxLookback, minBarsForLine, INDICATOR_LOOKBACK,
} from '@/util/technicalIndicators';
import { SLATE, CHART_GRID } from '@/config/themeColors';
import {
    getInterval, calcFetchDays, fetchFromDate, aggregateBars, takeRecentBars,
    intervalTickFormatter, intervalLabelFormatter, priceDomain, candleRange,
} from '@/util/chartInterval';
import { useChartPreference, CHART_STYLES } from '@/hooks/useChartPreference';
import { ChartControls } from '@/component/common/chart/ChartControls';
import { CandleShape } from '@/component/common/chart/CandleShape';
import { OhlcTooltip } from '@/component/common/chart/OhlcTooltip';

// 지표 정의
const OVERLAY_INDICATORS = [
    {
        key: 'sma20', label: 'SMA 20', color: '#f59e0b',
        desc: '최근 20봉 종가의 평균선 (단기, 일봉이면 20일·주봉이면 20주)',
        tip: '주가가 이 선 위에 있으면 단기 상승 추세, 아래면 하락 추세. 이 선이 지지선/저항선 역할을 자주 함',
    },
    {
        key: 'sma50', label: 'SMA 50', color: '#10b981',
        desc: '최근 50봉 종가의 평균선 (중기)',
        tip: 'SMA 20이 SMA 50을 위로 뚫으면 "골든크로스"(매수 신호), 아래로 뚫으면 "데드크로스"(매도 신호)',
    },
    {
        key: 'sma200', label: 'SMA 200', color: '#ef4444',
        desc: '최근 200봉 종가의 평균선 (장기)',
        tip: '투자자들이 가장 많이 보는 장기 지표. 주가가 이 선 위면 장기 상승장, 아래면 장기 하락장으로 판단',
    },
    {
        key: 'ema12', label: 'EMA 12', color: '#8b5cf6',
        desc: '12봉 지수이동평균 (최근 가격에 가중치)',
        tip: 'SMA보다 최근 움직임에 민감하게 반응. EMA 12가 EMA 26 위에 있으면 상승세',
    },
    {
        key: 'ema26', label: 'EMA 26', color: '#ec4899',
        desc: '26봉 지수이동평균',
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

// 가격 툴팁에 함께 보여줄 오버레이 지표 키 → 라벨
const OVERLAY_LABELS = {
    sma20: 'SMA 20', sma50: 'SMA 50', sma200: 'SMA 200',
    ema12: 'EMA 12', ema26: 'EMA 26',
    bbUpper: 'BB 상단', bbMiddle: 'BB 중간', bbLower: 'BB 하단',
};
const OVERLAY_VALUE_KEYS = {
    sma20: ['sma20'], sma50: ['sma50'], sma200: ['sma200'],
    ema12: ['ema12'], ema26: ['ema26'],
    bollinger: ['bbUpper', 'bbMiddle', 'bbLower'],
};

// 조회 시작일보다 이 일수 넘게 늦게 데이터가 시작하면 상장 이력이 거기까지뿐인 것으로 판단
const HISTORY_START_TOLERANCE_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 받을 수 있는 시세를 끝까지 받았는지 (조회 한도 도달 또는 상장 이력 부족) */
const isHistoryLimited = (sortedData, from, fetchDays) => {
    if (fetchDays >= calcFetchDays('year')) return true;
    if (!sortedData.length) return true;
    return new Date(sortedData[0].date) - new Date(from) > HISTORY_START_TOLERANCE_DAYS * DAY_MS;
};

// 가격 변동 색 (상승 빨강 / 하락 파랑 — 캔들과 동일, 적록색약 구분 가능)
const changeColorCls = (v) => (v >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400');

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
    const { interval, style, setInterval: setChartInterval, setStyle } = useChartPreference('chart.stock');
    const [selectedIndicators, setSelectedIndicators] = useState(DEFAULT_INDICATORS);
    const [historyLimited, setHistoryLimited] = useState(false); // 조회 한도(약 20년)·상장 이력 끝까지 받았는지

    // 선택한 지표 중 가장 긴 lookback (봉 단위)
    const maxLookback = useMemo(() => getMaxLookback(selectedIndicators), [selectedIndicators]);

    // 실제 API 요청 기간 (표시 봉 + 지표 lookback 봉 → 달력일, 최대 약 20년)
    const fetchDays = useMemo(() => calcFetchDays(interval, maxLookback), [interval, maxLookback]);

    // 이미 fetch한 일수 추적 — 지표 토글·봉 단위 변경 시 이미 충분하면 재요청 안 함 (일별 데이터 재집계만)
    const fetchedDaysRef = useRef(0);
    const prevIntervalRef = useRef(interval);
    const prevSymbolRef = useRef(symbol);

    useEffect(() => {
        if (!isOpen || !symbol) return;

        // 모달 열림, 심볼 변경 → 전체 로딩
        const needFullReload = prevSymbolRef.current !== symbol || rawData.length === 0;
        const intervalChanged = prevIntervalRef.current !== interval;

        prevIntervalRef.current = interval;
        prevSymbolRef.current = symbol;

        if (needFullReload) {
            fetchedDaysRef.current = 0;
            loadChartData(true);
            return;
        }

        if (fetchedDaysRef.current >= fetchDays) return;

        // 더 긴 데이터 필요: 봉 단위 변경은 로딩 표시, 지표 토글은 기존 차트 유지한 채 백그라운드 fetch
        loadChartData(intervalChanged);
    }, [isOpen, symbol, fetchDays]);

    const loadChartData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        setError(null);

        const to = new Date().toISOString().split('T')[0];
        const from = fetchFromDate(fetchDays);

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
                setHistoryLimited(isHistoryLimited(sortedData, from, fetchDays));
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

    // 봉 단위 집계 (지표 계산 전 전체)
    const allBars = useMemo(() => aggregateBars(rawData, interval), [rawData, interval]);

    // 받을 수 있는 데이터를 다 받았는데도 봉이 모자라 선을 못 그리는 지표 → { key: 필요 봉 수 }
    const unavailableIndicators = useMemo(() => {
        if (!historyLimited) return {};
        return Object.fromEntries(
            Object.keys(INDICATOR_LOOKBACK).filter((k) => minBarsForLine(k) > allBars.length).map((k) => [k, minBarsForLine(k)])
        );
    }, [historyLimited, allBars.length]);

    // 실제 계산·표시할 지표 (선택했어도 계산 불가면 제외, 선택 상태는 유지해 봉 단위를 바꾸면 다시 표시)
    const indicators = useMemo(
        () => Object.fromEntries(Object.keys(selectedIndicators).map((k) => [k, selectedIndicators[k] && !unavailableIndicators[k]])),
        [selectedIndicators, unavailableIndicators]
    );

    // 지표 계산 → 최근 봉만 표시
    const enrichedData = useMemo(() => {
        if (allBars.length === 0) return [];

        let result = allBars;

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

        return takeRecentBars(result, interval);
    }, [allBars, indicators, interval]);

    // 지표 토글
    const toggleIndicator = (key) => {
        setSelectedIndicators(prev => ({ ...prev, [key]: !prev[key] }));
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

    // 봉 단위 변경 시 줌 리셋
    const handleIntervalChange = (next) => {
        setChartInterval(next);
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
    // 헤더·최근 데이터 요약은 봉 단위와 무관하게 마지막 거래일(일별) 기준
    const latestData = rawData[rawData.length - 1];
    const previousData = rawData[rawData.length - 2];
    const change = latestData && previousData ? latestData.close - previousData.close : 0;
    const changePercent = latestData && previousData && previousData.close !== 0
        ? ((change / previousData.close) * 100)
        : 0;
    const isPositive = change >= 0;

    const intervalInfo = getInterval(interval);
    const tickFmt = intervalTickFormatter(interval);
    const labelFmt = intervalLabelFormatter(interval);
    const isCandle = style === CHART_STYLES.CANDLE;
    const overlayKeys = Object.keys(OVERLAY_VALUE_KEYS).filter((k) => indicators[k]).flatMap((k) => OVERLAY_VALUE_KEYS[k]);

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
                                    <div className={`flex items-center gap-1 text-sm font-medium ${changeColorCls(change)}`}>
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
                    {/* 봉 단위 + 선/캔들 */}
                    <ChartControls
                        interval={interval}
                        onIntervalChange={handleIntervalChange}
                        style={style}
                        onStyleChange={setStyle}
                        disabled={loading}
                    />
                    {/* 지표 토글 */}
                    <IndicatorToggle
                        indicators={indicators}
                        unavailable={unavailableIndicators}
                        unavailableReason={(key, label) => `${intervalInfo.label} ${allBars.length}개로는 ${label}(${unavailableIndicators[key]}봉 필요)을 그릴 수 없습니다`}
                        onToggle={toggleIndicator}
                    />
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
                                        주식 가격 ({intervalInfo.label} · 최근 {chartData.length}{intervalInfo.unit === '일' ? '거래일' : intervalInfo.unit})
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
                                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fill: SLATE[500] }}
                                            tickFormatter={tickFmt}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11, fill: SLATE[500] }}
                                            domain={priceDomain(zoomedData, overlayKeys)}
                                            tickFormatter={(value) => `$${value.toFixed(value < 10 ? 2 : 0)}`}
                                        />
                                        <Tooltip content={<OhlcTooltip labelFmt={labelFmt} prefix="$" extraRows={overlayKeys.map((k) => ({ key: k, label: OVERLAY_LABELS[k] }))} />} />

                                        {/* 캔들 / 선(고가·저가 점선 + 종가) — Recharts 2 는 Fragment 안 요소를 못 찾으므로 개별 조건 렌더링 */}
                                        {isCandle && <Bar dataKey={candleRange} shape={<CandleShape />} isAnimationActive={false} />}
                                        {!isCandle && <Line type="monotone" dataKey="high" stroke={SLATE[400]} strokeWidth={1} dot={false} strokeDasharray="3 3" />}
                                        {!isCandle && <Line type="monotone" dataKey="low" stroke={SLATE[400]} strokeWidth={1} dot={false} strokeDasharray="3 3" />}
                                        {!isCandle && <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />}

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
                                <PriceChartLegend indicators={indicators} isCandle={isCandle} />
                            </div>

                            {/* 거래량 차트 */}
                            <div className="bg-white rounded-lg border p-4 dark:bg-slate-700 dark:border-slate-600">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3 dark:text-slate-200">거래량</h3>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={zoomedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fill: SLATE[500] }}
                                            tickFormatter={tickFmt}
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
                                            labelFormatter={labelFmt}
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
                                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 11, fill: SLATE[500] }}
                                                tickFormatter={tickFmt}
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
                                                labelFormatter={labelFmt}
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
                                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 11, fill: SLATE[500] }}
                                                tickFormatter={tickFmt}
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
                                                labelFormatter={labelFmt}
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
                                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 11, fill: SLATE[500] }}
                                                tickFormatter={tickFmt}
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
                                                labelFormatter={labelFmt}
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
                                        최근 거래일 ({new Date(latestData.date).toLocaleDateString('ko-KR')})
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
                                            valueClassName={changeColorCls(latestData.change)}
                                        />
                                        <DataItem
                                            label="변동률"
                                            value={`${latestData.changePercent >= 0 ? '+' : ''}${latestData.changePercent.toFixed(2)}%`}
                                            valueClassName={changeColorCls(latestData.changePercent)}
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
const IndicatorToggle = ({ indicators, unavailable, unavailableReason, onToggle }) => {
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
                            disabled={!!unavailable[ind.key]}
                            title={unavailable[ind.key] ? unavailableReason(ind.key, ind.label) : undefined}
                            className={`px-2 py-1 rounded border text-xs font-medium transition-colors disabled:opacity-40 ${
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
                            disabled={!!unavailable[ind.key]}
                            title={unavailable[ind.key] ? unavailableReason(ind.key, ind.label) : undefined}
                            className={`px-2 py-1 rounded border text-xs font-medium transition-colors disabled:opacity-40 ${
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
const PriceChartLegend = ({ indicators, isCandle }) => {
    const items = isCandle
        ? [
            { color: 'var(--color-rose-500)', label: '상승 캔들', show: true },
            { color: 'var(--color-blue-500)', label: '하락 캔들', show: true },
        ]
        : [
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
 * 데이터 아이템 컴포넌트
 */
const DataItem = ({ label, value, valueClassName = '' }) => (
    <div>
        <div className="text-slate-500 mb-1 dark:text-slate-400">{label}</div>
        <div className={`font-semibold ${valueClassName || 'dark:text-slate-200'}`}>{value}</div>
    </div>
);

export default StockChartModal;
