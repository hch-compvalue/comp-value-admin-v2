import { useState, useEffect, useRef, useMemo } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchMultipleIndices } from '@/util/ChartApi';
import { SLATE, CHART_GRID } from '@/config/themeColors';
import {
    calcFetchDays, fetchFromDate, aggregateBars, takeRecentBars, getInterval,
    intervalTickFormatter, intervalLabelFormatter, priceDomain, candleRange,
} from '@/util/chartInterval';
import { useChartPreference, CHART_STYLES } from '@/hooks/useChartPreference';
import { ChartControls } from '@/component/common/chart/ChartControls';
import { CandleShape } from '@/component/common/chart/CandleShape';
import { OhlcTooltip } from '@/component/common/chart/OhlcTooltip';
import { Maximize2, X } from 'lucide-react';
import useModalAnimation from '@/hooks/useModalAnimation';

// 확대 창 열고 닫는 애니메이션 시간
const MODAL_ANIMATION_MS = 250;

// 미국 3대 지수 정보
const US_INDICES = [
    { symbol: '^GSPC', name: 'S&P 500', color: '#3b82f6' }, // blue
    { symbol: '^DJI', name: 'Dow Jones', color: '#8b5cf6' }, // purple
    { symbol: '^IXIC', name: 'NASDAQ', color: '#f59e0b' }, // amber (적록색약 — 초록 미사용)
];

export default function MarketIndexCharts() {
    const [chartsData, setChartsData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { interval, style, setInterval: setChartInterval, setStyle } = useChartPreference('chart.index');
    const fetchDays = calcFetchDays(interval);
    const [expandedSymbol, setExpandedSymbol] = useState(null);
    const fetchedDaysRef = useRef(0); // 이미 받은 일수 — 봉 단위 변경 시 충분하면 재집계만

    useEffect(() => {
        if (fetchedDaysRef.current >= fetchDays) return;
        loadChartData();
    }, [fetchDays]);

    const loadChartData = async () => {
        setLoading(true);
        setError(null);

        // 봉 단위별 조회 기간 (일별 시세)
        const to = new Date().toISOString().split('T')[0];
        const from = fetchFromDate(fetchDays);

        const queries = US_INDICES.map(index => ({
            symbol: index.symbol,
            from,
            to,
        }));

        try {
            const results = await fetchMultipleIndices(queries);
            const dataMap = {};
            let hasAnyData = false;

            results.forEach(({ symbol, data, error }) => {
                if (error) {
                    console.error(`Failed to load ${symbol}:`, error);
                    return;
                }

                if (data?.success && data?.response) {
                    // 날짜 기준 오름차순 정렬
                    const sortedData = [...data.response].sort((a, b) =>
                        new Date(a.date) - new Date(b.date)
                    );
                    dataMap[symbol] = sortedData;
                    hasAnyData = true;
                }
            });

            if (!hasAnyData) {
                setError('차트 데이터를 불러올 수 없습니다.');
            } else {
                fetchedDaysRef.current = fetchDays;
            }

            setChartsData(dataMap);
        } catch (err) {
            setError('차트 데이터를 불러오는데 실패했습니다.');
            console.error('MarketIndexCharts error:', err);
        } finally {
            setLoading(false);
        }
    };

    // 처음 불러올 때만 뼈대 — 봉 단위를 바꿔 다시 받는 동안은 기존 차트·확대 창 유지
    if (loading && Object.keys(chartsData).length === 0) {
        return (
            <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">미국 주요 지수</h2>
                    <ChartControls interval={interval} onIntervalChange={setChartInterval} style={style} onStyleChange={setStyle} disabled={loading} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {US_INDICES.map(index => (
                        <div key={index.symbol} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                            <div className="animate-pulse">
                                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3 dark:bg-slate-700"></div>
                                <div className="h-48 bg-slate-100 rounded dark:bg-slate-700"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">미국 주요 지수</h2>
                    <ChartControls interval={interval} onIntervalChange={setChartInterval} style={style} onStyleChange={setStyle} disabled={loading} />
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-orange-700 text-sm dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800 flex-shrink-0 dark:text-white">미국 주요 지수</h2>
                <div className="overflow-x-auto scrollbar-always min-w-0">
                    <ChartControls interval={interval} onIntervalChange={setChartInterval} style={style} onStyleChange={setStyle} disabled={loading} />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {US_INDICES.map(index => {
                    // 헤더(현재값·등락)는 마지막 거래일 기준, 차트는 봉 단위 집계
                    const daily = chartsData[index.symbol] || [];
                    const latestData = daily[daily.length - 1];
                    const previousData = daily[daily.length - 2];

                    const change = latestData && previousData
                        ? latestData.close - previousData.close
                        : 0;
                    const changePercent = latestData?.changePercent || 0;
                    const isPositive = change >= 0;

                    return (
                        <IndexCard
                            key={index.symbol}
                            index={index}
                            daily={daily}
                            interval={interval}
                            isCandle={style === CHART_STYLES.CANDLE}
                            latestData={latestData}
                            change={change}
                            changePercent={changePercent}
                            isPositive={isPositive}
                            onExpand={() => setExpandedSymbol(index.symbol)}
                        />
                    );
                })}
            </div>
            <IndexChartModal
                index={US_INDICES.find((x) => x.symbol === expandedSymbol)}
                daily={chartsData[expandedSymbol] || []}
                onClose={() => setExpandedSymbol(null)}
                controls={<ChartControls interval={interval} onIntervalChange={setChartInterval} style={style} onStyleChange={setStyle} disabled={loading} />}
                interval={interval}
                isCandle={style === CHART_STYLES.CANDLE}
            />
        </div>
    );
}

/** 봉 단위 집계 + 툴팁 등락률용 직전 봉 종가 (자르기 전에 붙여서 표시 첫 봉도 값이 있음) */
function useIndexBars(daily, interval) {
    return useMemo(() => {
        const bars = aggregateBars(daily, interval);
        return takeRecentBars(bars.map((bar, i) => ({ ...bar, prevClose: i > 0 ? bars[i - 1].close : null })), interval);
    }, [daily, interval]);
}

/** 현재값·등락 요약 (마지막 거래일 기준) */
function IndexSummary({ latestData, change, changePercent, isPositive, large = false }) {
    if (!latestData) return <div className="text-sm text-slate-500 dark:text-slate-400">최신 데이터 없음</div>;
    return (
        <>
            <div className="flex items-baseline gap-3">
                <span className={`${large ? 'text-3xl' : 'text-2xl'} font-bold text-slate-900 dark:text-white`}>
                    {latestData.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    <span>{isPositive ? '▲' : '▼'}</span>
                    <span>{Math.abs(change).toFixed(2)}</span>
                    <span>({Math.abs(changePercent).toFixed(2)}%)</span>
                </div>
            </div>
            <div className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                {new Date(latestData.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
        </>
    );
}

/** 지수 차트 본체 — 카드(작게)와 확대 창(크게)이 같이 씀 */
function IndexChart({ data, interval, isCandle, color, large = false }) {
    const fontSize = large ? 12 : 10;
    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={large ? { top: 5, right: 10, left: 0, bottom: 5 } : { top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={{ fontSize, fill: SLATE[500] }} tickFormatter={intervalTickFormatter(interval)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize, fill: SLATE[500] }} domain={priceDomain(data)} tickFormatter={(value) => value.toFixed(0)} />
                <Tooltip content={<OhlcTooltip labelFmt={intervalLabelFormatter(interval)} changeLabel={getInterval(interval).prevLabel} />} />
                {isCandle ? (
                    <Bar dataKey={candleRange} shape={<CandleShape />} isAnimationActive={false} />
                ) : (
                    <Line type="monotone" dataKey="close" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                )}
            </ComposedChart>
        </ResponsiveContainer>
    );
}

function IndexCard({ index, daily, interval, isCandle, latestData, change, changePercent, isPositive, onExpand }) {
    const data = useIndexBars(daily, interval);

    // 데이터가 없는 경우 처리
    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-800 dark:text-white">{index.name}</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{index.symbol}</span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">데이터 없음</div>
                </div>
                <div className="p-4">
                    <div className="h-[180px] flex items-center justify-center bg-slate-50 rounded dark:bg-slate-700">
                        <span className="text-xs text-slate-400 dark:text-slate-500">차트 데이터를 불러올 수 없습니다</span>
                    </div>
                </div>
            </div>
        );
    }

    // 카드 어디를 눌러도 확대 (키보드: Enter·Space)
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onExpand}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(); } }}
            aria-label={`${index.name} 차트 크게 보기`}
            className="group cursor-pointer bg-white rounded-lg border border-slate-200 shadow-sm transition-colors hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-blue-600"
        >
            <div className="p-4 border-b border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-800 dark:text-white">{index.name}</h3>
                    <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {index.symbol}
                        <Maximize2 aria-hidden="true" className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-500" />
                    </span>
                </div>
                <IndexSummary latestData={latestData} change={change} changePercent={changePercent} isPositive={isPositive} />
            </div>
            <div className="p-4" style={{ width: '100%', height: '200px' }}>
                <IndexChart data={data} interval={interval} isCandle={isCandle} color={index.color} />
            </div>
        </div>
    );
}

/** 지수 차트 확대 창 — 봉 단위·차트 형태 바꾸면 홈 카드에도 같이 적용 */
function IndexChartModal({ index, daily, onClose, controls, interval, isCandle }) {
    const isOpen = Boolean(index);
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, MODAL_ANIMATION_MS);
    const lastIndexRef = useRef(index);
    if (index) lastIndexRef.current = index; // 닫히는 애니메이션 동안 내용 유지
    const shown = lastIndexRef.current;
    const data = useIndexBars(daily, interval);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!shouldRender || !shown) return null;
    const latest = daily[daily.length - 1];
    const previous = daily[daily.length - 2];
    const change = latest && previous ? latest.close - previous.close : 0;
    const animation = { animationDuration: `${MODAL_ANIMATION_MS}ms` };

    return (
        <>
            <div className={`fixed inset-0 z-[120] bg-black/50 dark:bg-black/70 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={animation} onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`${shown.name} 차트`}
                className={`fixed left-1/2 top-1/2 z-[130] flex max-h-[90vh] w-[min(1100px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-auto rounded-lg bg-white shadow-xl dark:bg-slate-800 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`}
                style={animation}
            >
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{shown.name}</h2>
                                <span className="text-xs text-slate-500 dark:text-slate-400">{shown.symbol}</span>
                            </div>
                            <IndexSummary latestData={latest} change={change} changePercent={latest?.changePercent || 0} isPositive={change >= 0} large />
                        </div>
                        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="overflow-x-auto">{controls}</div>
                </div>
                <div className="h-[min(65vh,560px)] min-h-[280px] p-4">
                    {data.length > 0
                        ? <IndexChart data={data} interval={interval} isCandle={isCandle} color={shown.color} large />
                        : <div className="flex h-full items-center justify-center text-sm text-slate-400">차트 데이터를 불러올 수 없습니다</div>}
                </div>
            </div>
        </>
    );
}
