import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchMultipleIndices } from '@/util/ChartApi';
import { SLATE } from '@/config/themeColors';

// 미국 3대 지수 정보
const US_INDICES = [
    { symbol: '^GSPC', name: 'S&P 500', color: '#3b82f6' }, // blue
    { symbol: '^DJI', name: 'Dow Jones', color: '#8b5cf6' }, // purple
    { symbol: '^IXIC', name: 'NASDAQ', color: '#10b981' }, // green
];

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

export default function MarketIndexCharts() {
    const [chartsData, setChartsData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState(30); // 기본값 30일

    useEffect(() => {
        loadChartData();
    }, [period]);

    const loadChartData = async () => {
        setLoading(true);
        setError(null);

        // 선택된 기간에 따라 데이터 조회
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
            }

            setChartsData(dataMap);
        } catch (err) {
            setError('차트 데이터를 불러오는데 실패했습니다.');
            console.error('MarketIndexCharts error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">미국 주요 지수</h2>
                    <PeriodSelector period={period} onChange={setPeriod} disabled={loading} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {US_INDICES.map(index => (
                        <div key={index.symbol} className="bg-white rounded-lg border p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
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
                    <PeriodSelector period={period} onChange={setPeriod} disabled={loading} />
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
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
                    <PeriodSelector period={period} onChange={setPeriod} disabled={loading} />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {US_INDICES.map(index => {
                    const data = chartsData[index.symbol] || [];
                    const latestData = data[data.length - 1];
                    const previousData = data[data.length - 2];

                    const change = latestData && previousData
                        ? latestData.close - previousData.close
                        : 0;
                    const changePercent = latestData?.changePercent || 0;
                    const isPositive = change >= 0;

                    return (
                        <IndexCard
                            key={index.symbol}
                            index={index}
                            data={data}
                            latestData={latestData}
                            change={change}
                            changePercent={changePercent}
                            isPositive={isPositive}
                        />
                    );
                })}
            </div>
        </div>
    );
}

/**
 * 기간 선택 컴포넌트
 */
function PeriodSelector({ period, onChange, disabled }) {
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
                    className={`flex-shrink-0 md:px-3 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                        period === option.value
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ minWidth: 48 }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function IndexCard({ index, data, latestData, change, changePercent, isPositive }) {
    // 데이터가 없는 경우 처리
    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-lg border shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 dark:border-slate-700">
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

    return (
        <div className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow dark:bg-slate-800 dark:border-slate-700">
            <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-800 dark:text-white">{index.name}</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{index.symbol}</span>
                </div>
                {latestData ? (
                    <>
                        <div className="flex items-baseline gap-3">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                {latestData.close.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}
                            </span>
                            <div className={`flex items-center gap-1 text-sm font-medium ${
                                isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                                <span>{isPositive ? '▲' : '▼'}</span>
                                <span>{Math.abs(change).toFixed(2)}</span>
                                <span>({Math.abs(changePercent).toFixed(2)}%)</span>
                            </div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                            {new Date(latestData.date).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </div>
                    </>
                ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400">최신 데이터 없음</div>
                )}
            </div>

            <div className="p-4" style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={SLATE[100]} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: SLATE[500] }}
                            tickFormatter={(date) => {
                                const d = new Date(date);
                                return `${d.getMonth() + 1}/${d.getDate()}`;
                            }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: SLATE[500] }}
                            domain={['dataMin - 50', 'dataMax + 50']}
                            tickFormatter={(value) => value.toFixed(0)}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid var(--color-slate-200)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                padding: '8px 12px',
                            }}
                            formatter={(value) => [
                                value.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                }),
                                'Close'
                            ]}
                            labelFormatter={(date) =>
                                new Date(date).toLocaleDateString('ko-KR', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })
                            }
                        />
                        <Line
                            type="monotone"
                            dataKey="close"
                            stroke={index.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
