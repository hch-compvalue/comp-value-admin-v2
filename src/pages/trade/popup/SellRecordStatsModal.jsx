import { useEffect, useMemo } from 'react';
import {
    AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import useModalAnimation from '@/hooks/useModalAnimation';
import { useTheme } from '@/context/ThemeContext';
import { calcFxPnl, calcPriceGainKrw, calcTotalPnlKrw } from '@/util/SellRecordUtil';
import { SLATE } from '@/config/themeColors';

// 손익 방향(diverging) 팔레트 — 국내 주식 관행(상승=로즈/하락=파랑), 적록색약 무관(로즈↔파랑 조합)
const COLORS = {
    profit: { light: '#e11d48', dark: '#fb7185' },
    loss: { light: '#2563eb', dark: '#3b82f6' },
    grid: { light: SLATE[200], dark: SLATE[700] },
    axis: { light: SLATE[500], dark: SLATE[400] },
};

const SYMBOL_TOP_N = 10;

const formatWon = (n) => Math.round(n || 0).toLocaleString('ko-KR');
const formatSignedWon = (n) => `${(n || 0) >= 0 ? '+' : ''}₩${formatWon(n)}`;

export default function SellRecordStatsModal({ isOpen, onClose, records = [], fxRate, periodLabel = '' }) {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 250);
    const { isDark } = useTheme();
    const c = (role) => COLORS[role][isDark ? 'dark' : 'light'];

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const stats = useMemo(() => {
        // 레코드별 파생값 계산
        const enriched = records.map(r => {
            const priceGainKrw = calcPriceGainKrw(r, fxRate);
            const fxPnl = calcFxPnl(r);
            const totalPnl = calcTotalPnlKrw(r, fxRate);
            return { ...r, priceGainKrw, fxPnl, totalPnl };
        });

        const withTotal = enriched.filter(r => r.totalPnl !== null);
        const totalPnlSum = withTotal.reduce((s, r) => s + r.totalPnl, 0);
        const priceGainSum = enriched.reduce((s, r) => s + (r.priceGainKrw || 0), 0);
        const fxPnlSum = enriched.reduce((s, r) => s + (r.fxPnl || 0), 0);
        const fxMissingCount = enriched.filter(r => r.fxPnl === null).length;

        const winCount = withTotal.filter(r => r.totalPnl >= 0).length;
        const lossCount = withTotal.filter(r => r.totalPnl < 0).length;
        const winRate = withTotal.length > 0 ? (winCount / withTotal.length) * 100 : 0;
        const avgPnlPerTrade = withTotal.length > 0 ? totalPnlSum / withTotal.length : 0;

        const best = withTotal.reduce((max, r) => (!max || r.totalPnl > max.totalPnl ? r : max), null);
        const worst = withTotal.reduce((min, r) => (!min || r.totalPnl < min.totalPnl ? r : min), null);

        // 월별 집계 (오름차순)
        const byMonth = new Map();
        withTotal.forEach(r => {
            const month = r.sellDate.substring(0, 7);
            const cur = byMonth.get(month) || { month, total: 0, count: 0 };
            cur.total += r.totalPnl;
            cur.count += 1;
            byMonth.set(month, cur);
        });
        const monthlySeries = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));

        // 누적 총손익 (매도일순)
        const sortedByDate = [...withTotal].sort((a, b) => a.sellDate.localeCompare(b.sellDate));
        let cumulative = 0;
        const cumulativeSeries = sortedByDate.map(r => {
            cumulative += r.totalPnl;
            return { date: r.sellDate, cumulative };
        });

        // 종목별 집계 (총손익 절대값 내림차순 Top N)
        const bySymbol = new Map();
        withTotal.forEach(r => {
            const key = r.symbol;
            const cur = bySymbol.get(key) || { symbol: r.symbol, companyName: r.companyName, total: 0, count: 0, winCount: 0 };
            cur.total += r.totalPnl;
            cur.count += 1;
            if (r.totalPnl >= 0) cur.winCount += 1;
            bySymbol.set(key, cur);
        });
        const symbolAgg = Array.from(bySymbol.values()).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
        const symbolTop = symbolAgg.slice(0, SYMBOL_TOP_N);

        return {
            count: records.length,
            totalPnlSum, priceGainSum, fxPnlSum, fxMissingCount,
            winCount, lossCount, winRate, avgPnlPerTrade,
            best, worst,
            monthlySeries, cumulativeSeries, symbolAgg, symbolTop,
        };
    }, [records, fxRate]);

    if (!shouldRender) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const hasData = stats.count > 0;
    const cumulativeColor = stats.totalPnlSum >= 0 ? c('profit') : c('loss');

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 p-2 sm:p-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
            style={{ animationDuration: '0.25s' }}
            onClick={handleBackdropClick}
        >
            <div
                className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
                style={{ animationDuration: '0.25s' }}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2h14" />
                            </svg>
                            매도 현황 분석
                        </h3>
                        {periodLabel && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">{periodLabel}</span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        aria-label="닫기"
                    >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {!hasData ? (
                    <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                        분석할 매도 기록이 없습니다.
                    </div>
                ) : (
                    <div className="p-4 sm:p-6 space-y-6">
                        {/* ① KPI 카드 */}
                        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <KpiCard label="총 매도 건수" value={`${stats.count}건`} />
                            <KpiCard
                                label="승률"
                                value={`${stats.winRate.toFixed(1)}%`}
                                sub={`익 ${stats.winCount} · 손 ${stats.lossCount}`}
                                tone={stats.winRate >= 50 ? 'profit' : 'loss'}
                            />
                            <KpiCard
                                label="총손익"
                                value={formatSignedWon(stats.totalPnlSum)}
                                tone={stats.totalPnlSum >= 0 ? 'profit' : 'loss'}
                            />
                            <KpiCard
                                label="거래당 평균손익"
                                value={formatSignedWon(stats.avgPnlPerTrade)}
                                tone={stats.avgPnlPerTrade >= 0 ? 'profit' : 'loss'}
                            />
                            <KpiCard
                                label="총 가격손익"
                                value={formatSignedWon(stats.priceGainSum)}
                                tone={stats.priceGainSum >= 0 ? 'profit' : 'loss'}
                            />
                            <KpiCard
                                label="총 환차손익"
                                value={formatSignedWon(stats.fxPnlSum)}
                                sub={stats.fxMissingCount > 0 ? `환율 미기재 ${stats.fxMissingCount}건 제외` : undefined}
                                tone={stats.fxPnlSum >= 0 ? 'profit' : 'loss'}
                            />
                            <KpiCard
                                label="베스트 트레이드"
                                value={stats.best ? formatSignedWon(stats.best.totalPnl) : '-'}
                                sub={stats.best ? `${stats.best.symbol} · ${stats.best.sellDate}` : undefined}
                                tone="profit"
                            />
                            <KpiCard
                                label="워스트 트레이드"
                                value={stats.worst ? formatSignedWon(stats.worst.totalPnl) : '-'}
                                sub={stats.worst ? `${stats.worst.symbol} · ${stats.worst.sellDate}` : undefined}
                                tone="loss"
                            />
                        </section>

                        {/* ② 누적 총손익 추이 */}
                        <section className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">누적 총손익 추이</h4>
                            <div style={{ width: '100%', height: 260 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={stats.cumulativeSeries}>
                                        <defs>
                                            <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={cumulativeColor} stopOpacity={0.15} />
                                                <stop offset="100%" stopColor={cumulativeColor} stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={c('grid')} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 10, fill: c('axis') }}
                                            tickFormatter={(v) => v.substring(5)}
                                            minTickGap={30}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: c('axis') }}
                                            tickFormatter={(v) => `${Math.round(v / 10000).toLocaleString()}만`}
                                        />
                                        <ReferenceLine y={0} stroke={c('axis')} strokeDasharray="3 3" />
                                        <Tooltip
                                            contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                            formatter={(v) => [formatSignedWon(v), '누적 총손익']}
                                            labelFormatter={(v) => v}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="cumulative"
                                            stroke={cumulativeColor}
                                            strokeWidth={2}
                                            fill="url(#cumulativeGradient)"
                                            dot={false}
                                            activeDot={{ r: 5 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        {/* ③ 월별 총손익 + 승/패 비율 */}
                        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">월별 총손익</h4>
                                <div style={{ width: '100%', height: 260 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={stats.monthlySeries} barCategoryGap="30%">
                                            <CartesianGrid strokeDasharray="3 3" stroke={c('grid')} />
                                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: c('axis') }} />
                                            <YAxis
                                                tick={{ fontSize: 10, fill: c('axis') }}
                                                tickFormatter={(v) => `${Math.round(v / 10000).toLocaleString()}만`}
                                            />
                                            <ReferenceLine y={0} stroke={c('axis')} />
                                            <Tooltip
                                                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                                formatter={(v, _n, entry) => [`${formatSignedWon(v)} (${entry?.payload?.count ?? 0}건)`, '총손익']}
                                            />
                                            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                                {stats.monthlySeries.map((d) => (
                                                    <Cell key={d.month} fill={d.total >= 0 ? c('profit') : c('loss')} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">승/패 비율</h4>
                                <div style={{ width: '100%', height: 260 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { key: 'win', label: '이익', value: stats.winCount },
                                                    { key: 'loss', label: '손실', value: stats.lossCount },
                                                ].filter(d => d.value > 0)}
                                                dataKey="value"
                                                nameKey="label"
                                                innerRadius={50}
                                                outerRadius={90}
                                                paddingAngle={2}
                                                label={({ label, value }) => `${label} ${value}건`}
                                                labelLine={false}
                                            >
                                                <Cell key="win" fill={c('profit')} />
                                                <Cell key="loss" fill={c('loss')} />
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                                formatter={(v, name) => [`${v}건`, name]}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </section>

                        {/* ④ 종목별 총손익 Top N */}
                        <section className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                                종목별 총손익 Top {SYMBOL_TOP_N} <span className="text-xs text-slate-400">(절대값 기준)</span>
                            </h4>
                            <div style={{ width: '100%', height: Math.max(200, stats.symbolTop.length * 32) }}>
                                <ResponsiveContainer>
                                    <BarChart data={stats.symbolTop} layout="vertical" margin={{ left: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={c('grid')} />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 10, fill: c('axis') }}
                                            tickFormatter={(v) => `${Math.round(v / 10000).toLocaleString()}만`}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="symbol"
                                            tick={{ fontSize: 11, fill: c('axis') }}
                                            width={60}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                            formatter={(v, _name, entry) => [
                                                `${formatSignedWon(v)} (${entry?.payload?.count ?? 0}건)`,
                                                entry?.payload?.companyName || '총손익',
                                            ]}
                                        />
                                        <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={20}>
                                            {stats.symbolTop.map((d) => (
                                                <Cell key={d.symbol} fill={d.total >= 0 ? c('profit') : c('loss')} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        {/* ⑤ 종목별 집계 테이블 */}
                        <section className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">종목별 집계</h4>
                            <div className="overflow-x-auto overflow-y-auto max-h-72 border border-slate-200 dark:border-slate-700 rounded">
                                <table className="w-full text-sm border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-700">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">티커</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">기업명</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">매도건수</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">승률</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">총손익(₩)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                        {stats.symbolAgg.map((row) => (
                                            <tr key={row.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                <td className="px-3 py-2 font-semibold text-blue-600 dark:text-blue-400">{row.symbol}</td>
                                                <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.companyName}</td>
                                                <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{row.count}건</td>
                                                <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{((row.winCount / row.count) * 100).toFixed(0)}%</td>
                                                <td className={`px-3 py-2 text-right font-semibold ${row.total >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                    {formatSignedWon(row.total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}

function KpiCard({ label, value, sub, tone = 'neutral' }) {
    const valueClass = tone === 'profit'
        ? 'text-rose-600 dark:text-rose-400'
        : tone === 'loss'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-slate-900 dark:text-white';
    return (
        <div className="p-4 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
            <div className={`text-lg font-bold truncate ${valueClass}`}>{value}</div>
            {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">{sub}</div>}
        </div>
    );
}
