import { useEffect, useMemo } from 'react';
import {
    AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import useModalAnimation from '@/hooks/useModalAnimation';
import {
    MARKET, MARKET_META, tabMarket, isLegacyRecord, displayName,
    computeFlow, computeFlowByMarket, computeFlowBySymbol,
} from '../history/historyCommon';
import { SLATE } from '@/config/themeColors';

// 적록색약 친화 팔레트 (파랑/주황/청록/호박/보라/노랑/슬레이트)
const PALETTE = {
    profit: '#3b82f6',      // 파랑 — 익절/이익
    loss: '#f97316',        // 주황 — 손절/손실
    trailing: '#14b8a6',    // 청록 — 트레일링스탑
    expired: '#a855f7',     // 보라 — 만료매도
    maxHold: '#f59e0b',     // 호박 — 강제청산
    manual: '#eab308',      // 노랑 — 수동매도
    neutral: SLATE[500],     // 슬레이트
    buy: '#3b82f6',         // 파랑 — 매수
    sell: '#f59e0b',        // 호박 — 매도
};

const CHART_HEIGHT = 260;
const SYMBOL_ROW_HEIGHT = 36;
const SYMBOL_TOP_N = 10;
const AXIS_WAN = 10000; // 축 단위: 만원
const SYMBOL_AXIS_WIDTH = 150;
const LEGACY_COIN_ROW_HEIGHT = 32;

const REASON_META = [
    { key: 'takeProfit', label: '익절', color: PALETTE.profit, match: ['TAKE_PROFIT', 'PARTIAL_TAKE_PROFIT'] },
    { key: 'stopLoss', label: '손절', color: PALETTE.loss, match: ['STOP_LOSS', 'PARTIAL_STOP_LOSS'] },
    { key: 'trailingStop', label: '트레일링', color: PALETTE.trailing, match: ['TRAILING_STOP', 'PARTIAL_TRAILING_STOP'] },
    { key: 'maxHoldExpired', label: '강제청산', color: PALETTE.maxHold, match: ['MAX_HOLD_EXPIRED', 'MAX_HOLDING_EXPIRED'] },
    { key: 'manual', label: '수동매도', color: PALETTE.manual, match: ['MANUAL', 'PARTIAL_MANUAL', 'MANUAL_CLEANUP', 'CLEANUP_NO_BALANCE'] },
    { key: 'expired', label: '만료매도', color: PALETTE.expired, match: null /* 하단에서 패턴 매칭 */ },
];

const formatNumber = (n) => Math.floor(n || 0).toLocaleString('en-US');
const formatSignedNumber = (n) => `${(n || 0) >= 0 ? '+' : ''}${formatNumber(n)}`;

const classifyReason = (reason) => {
    if (!reason) return null;
    for (const meta of REASON_META) {
        if (meta.match && meta.match.includes(reason)) return meta.key;
    }
    if (reason === 'EXPIRED' || /^(PARTIAL_)?\d+DAY_PROFIT$/.test(reason)) return 'expired';
    return null;
};

/**
 * 거래기록 통계 모달
 * - 현재 전략(추세 리밸런싱): 선택 탭 시장의 매수/매도 흐름 + 종목별 금액 (건별 손익 없음)
 * - 구 전략(v4 단타) 포함 시: 구 전략 기록만 승률·실현손익·사유별 통계
 */
export default function HistoryStatsModal({ isOpen, onClose, records = [], symbolNames = {}, activeTab = 'all', includeLegacy = false, periodLabel = '' }) {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 250);

    // ESC 닫기 + 스크롤 잠금
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

    const currentRows = useMemo(() => records.filter((r) => !isLegacyRecord(r)), [records]);
    const legacyRows = useMemo(() => records.filter(isLegacyRecord), [records]);

    if (!shouldRender) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
            style={{ animationDuration: '0.25s' }}
            onClick={handleBackdropClick}
        >
            <div
                className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col animate__animated ${isAnimatingOut ? 'animate__zoomOut' : 'animate__zoomIn'}`}
                style={{ animationDuration: '0.25s' }}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">📊 통계 보기</h3>
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

                <div className="p-4 sm:p-6 space-y-8">
                    <CurrentStats rows={currentRows} market={tabMarket(activeTab)} symbolNames={symbolNames} />
                    {includeLegacy && <LegacyStats records={legacyRows} />}
                </div>
            </div>
        </div>
    );
}

/** 현재 전략 통계 — 매수/매도 금액 흐름 (추세 리밸런싱은 건별 손익을 기록하지 않음) */
function CurrentStats({ rows, market, symbolNames }) {
    const flow = useMemo(() => computeFlow(rows), [rows]);
    const byMarket = useMemo(() => computeFlowByMarket(rows), [rows]);
    const symbolData = useMemo(() => computeFlowBySymbol(rows).slice(0, SYMBOL_TOP_N).map((d) => ({
        ...d,
        label: displayName(d.code, symbolNames),
    })), [rows, symbolNames]);

    return (
        <section className="space-y-4">
            <SectionTitle title="현재 전략 (추세 리밸런싱)" sub={`${flow.count}건 · 전략 수익률은 자동매매 화면에서 확인`} />
            {flow.count === 0 ? (
                <EmptyNote text="조회 조건에 해당하는 현재 전략 거래가 없습니다." />
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <KpiCard label="매수" value={`${flow.buyCount}건`} sub={`${formatNumber(flow.buyAmount)}원`} />
                        <KpiCard label="매도" value={`${flow.sellCount}건`} sub={`${formatNumber(flow.sellAmount)}원`} />
                        <KpiCard label="순매수 (매수-매도)" value={`${formatSignedNumber(flow.netBuy)}원`} />
                        {!market && [MARKET.CRYPTO, MARKET.KRX].map((m) => (
                            <KpiCard
                                key={m}
                                label={`${MARKET_META[m].label} 순매수`}
                                value={`${formatSignedNumber(byMarket[m].netBuy)}원`}
                                sub={`매수 ${byMarket[m].buyCount} · 매도 ${byMarket[m].sellCount}건`}
                                tone={m === MARKET.CRYPTO ? 'profit' : 'stock'}
                            />
                        ))}
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                            종목별 매수·매도 금액 <span className="text-xs text-slate-400">(거래금액 상위 {SYMBOL_TOP_N})</span>
                        </h4>
                        <div style={{ width: '100%', height: Math.max(CHART_HEIGHT, symbolData.length * SYMBOL_ROW_HEIGHT) }}>
                            <ResponsiveContainer>
                                <BarChart data={symbolData} layout="vertical" margin={{ left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={SLATE[300]} strokeOpacity={0.3} />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: SLATE[500] }} tickFormatter={(v) => `${(v / AXIS_WAN).toFixed(0)}만`} />
                                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: SLATE[500] }} width={SYMBOL_AXIS_WIDTH} />
                                    <Tooltip
                                        contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                        formatter={(v, name) => [`${formatNumber(v)}원`, name]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="buyAmount" name="매수 금액" fill={PALETTE.buy} radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="sellAmount" name="매도 금액" fill={PALETTE.sell} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}

/** 구 전략(v4 단타) 손익 통계 — 구 전략 기록만 집계 */
function LegacyStats({ records }) {
    // 통계 계산
    const stats = useMemo(() => {
        const sells = records.filter(r => r.tradeType === 'SELL');
        const buys = records.filter(r => r.tradeType === 'BUY');

        const totalProfit = sells.reduce((s, r) => s + (r.profitLoss || 0), 0);
        const winCount = sells.filter(r => (r.profitLoss || 0) > 0).length;
        const lossCount = sells.filter(r => (r.profitLoss || 0) < 0).length;
        const winRate = sells.length > 0 ? (winCount / sells.length) * 100 : 0;
        const avgProfitPerTrade = sells.length > 0 ? totalProfit / sells.length : 0;

        // 매도 사유별 집계
        const reasonAgg = REASON_META.reduce((acc, m) => {
            acc[m.key] = { label: m.label, color: m.color, count: 0, profit: 0 };
            return acc;
        }, {});
        sells.forEach(r => {
            const key = classifyReason(r.reason);
            if (!key) return;
            reasonAgg[key].count += 1;
            reasonAgg[key].profit += (r.profitLoss || 0);
        });
        const reasonData = Object.entries(reasonAgg)
            .map(([key, v]) => ({ key, ...v }))
            .filter(d => d.count > 0);

        // 누적 손익 곡선 (매도 시간순)
        const sortedSells = [...sells].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        let cumulative = 0;
        const cumulativeSeries = sortedSells.map(r => {
            cumulative += (r.profitLoss || 0);
            return {
                time: r.createdAt,
                cumulative,
            };
        });

        // 종목별 기여 Top 10 (|profitLoss| 내림차순)
        const byCoin = new Map();
        sells.forEach(r => {
            const code = (r.coinCode || '-').replace('KRW-', '');
            const cur = byCoin.get(code) || { coinCode: code, profit: 0, count: 0 };
            cur.profit += (r.profitLoss || 0);
            cur.count += 1;
            byCoin.set(code, cur);
        });
        const coinTop10 = Array.from(byCoin.values())
            .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
            .slice(0, 10);

        return {
            buyCount: buys.length,
            sellCount: sells.length,
            totalProfit,
            winCount,
            lossCount,
            winRate,
            avgProfitPerTrade,
            reasonData,
            cumulativeSeries,
            coinTop10,
        };
    }, [records]);

    const hasData = stats.sellCount > 0;

    return (
        <section className="space-y-4 pt-6 border-t border-dashed border-slate-300 dark:border-slate-600">
            <SectionTitle title="구 전략(v4 단타) 손익 통계" sub={`${records.length}건 · 구 전략 기록만 집계`} />
                {!hasData ? (
                    <EmptyNote text="통계를 계산할 구 전략 매도 거래가 없습니다." />
                ) : (
                    <div className="space-y-6">
                        {/* ① KPI 카드 */}
                        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <KpiCard label="총 매도 거래" value={`${stats.sellCount}건`} sub={`매수 ${stats.buyCount}건`} />
                            <KpiCard
                                label="승률"
                                value={`${stats.winRate.toFixed(1)}%`}
                                sub={`익 ${stats.winCount} · 손 ${stats.lossCount}`}
                                tone={stats.winRate >= 50 ? 'profit' : 'loss'}
                            />
                            <KpiCard
                                label="총 실현손익"
                                value={`${formatSignedNumber(stats.totalProfit)}원`}
                                tone={stats.totalProfit >= 0 ? 'profit' : 'loss'}
                            />
                            <KpiCard
                                label="거래당 평균 손익"
                                value={`${formatSignedNumber(stats.avgProfitPerTrade)}원`}
                                tone={stats.avgProfitPerTrade >= 0 ? 'profit' : 'loss'}
                            />
                        </section>

                        {/* ② 누적 손익 곡선 */}
                        <section className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">누적 실현손익 추이</h4>
                            <div style={{ width: '100%', height: CHART_HEIGHT }}>
                                <ResponsiveContainer>
                                    <AreaChart data={stats.cumulativeSeries}>
                                        <defs>
                                            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={PALETTE.profit} stopOpacity={0.4} />
                                                <stop offset="100%" stopColor={PALETTE.profit} stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={SLATE[300]} strokeOpacity={0.3} />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fontSize: 10, fill: SLATE[500] }}
                                            tickFormatter={(v) => {
                                                const d = new Date(v);
                                                return `${d.getMonth() + 1}/${d.getDate()}`;
                                            }}
                                            minTickGap={30}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: SLATE[500] }}
                                            tickFormatter={(v) => `${(v / AXIS_WAN).toFixed(0)}만`}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                            formatter={(v) => [`${formatSignedNumber(v)}원`, '누적 손익']}
                                            labelFormatter={(v) => new Date(v).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="cumulative"
                                            stroke={PALETTE.profit}
                                            strokeWidth={2}
                                            fill="url(#profitGradient)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        {/* ③ 매도 사유 분포 + 기여 */}
                        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* 건수 도넛 */}
                            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">매도 사유별 건수 분포</h4>
                                <div style={{ width: '100%', height: CHART_HEIGHT }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={stats.reasonData}
                                                dataKey="count"
                                                nameKey="label"
                                                innerRadius={50}
                                                outerRadius={90}
                                                paddingAngle={2}
                                                label={({ label, count }) => `${label} ${count}`}
                                                labelLine={false}
                                            >
                                                {stats.reasonData.map((d) => (
                                                    <Cell key={d.key} fill={d.color} />
                                                ))}
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

                            {/* 수익 기여 막대 */}
                            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">매도 사유별 실현손익 기여</h4>
                                <div style={{ width: '100%', height: CHART_HEIGHT }}>
                                    <ResponsiveContainer>
                                        <BarChart data={stats.reasonData} layout="vertical" margin={{ left: 16 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={SLATE[300]} strokeOpacity={0.3} />
                                            <XAxis
                                                type="number"
                                                tick={{ fontSize: 10, fill: SLATE[500] }}
                                                tickFormatter={(v) => `${(v / AXIS_WAN).toFixed(0)}만`}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="label"
                                                tick={{ fontSize: 11, fill: SLATE[500] }}
                                                width={70}
                                            />
                                            <Tooltip
                                                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                                formatter={(v) => [`${formatSignedNumber(v)}원`, '손익']}
                                            />
                                            <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                                                {stats.reasonData.map((d) => (
                                                    <Cell key={d.key} fill={d.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </section>

                        {/* ④ 종목별 기여 Top 10 */}
                        <section className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                                종목별 실현손익 Top 10 <span className="text-xs text-slate-400">(절대값 기준)</span>
                            </h4>
                            <div style={{ width: '100%', height: Math.max(CHART_HEIGHT, stats.coinTop10.length * LEGACY_COIN_ROW_HEIGHT) }}>
                                <ResponsiveContainer>
                                    <BarChart data={stats.coinTop10} layout="vertical" margin={{ left: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={SLATE[300]} strokeOpacity={0.3} />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 10, fill: SLATE[500] }}
                                            tickFormatter={(v) => `${(v / AXIS_WAN).toFixed(0)}만`}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="coinCode"
                                            tick={{ fontSize: 11, fill: SLATE[500] }}
                                            width={80}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                            formatter={(v, _name, entry) => [
                                                `${formatSignedNumber(v)}원 (${entry?.payload?.count ?? 0}건)`,
                                                '손익',
                                            ]}
                                        />
                                        <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                                            {stats.coinTop10.map((d) => (
                                                <Cell key={d.coinCode} fill={d.profit >= 0 ? PALETTE.profit : PALETTE.loss} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    </div>
                )}
        </section>
    );
}

function SectionTitle({ title, sub }) {
    return (
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
            {sub && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{sub}</span>}
        </h3>
    );
}

function EmptyNote({ text }) {
    return <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{text}</div>;
}

// KPI 카드 톤 (적록색약 — 이익/코인 파랑, 손실 주황, 주식 호박)
const KPI_TONE = {
    profit: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
    loss: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300',
    stock: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    neutral: 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200',
};

function KpiCard({ label, value, sub, tone = 'neutral' }) {
    const toneClass = KPI_TONE[tone] ?? KPI_TONE.neutral;
    return (
        <div className={`p-4 rounded-lg border ${toneClass}`}>
            <div className="text-xs opacity-80 mb-1">{label}</div>
            <div className="text-lg font-bold">{value}</div>
            {sub && <div className="text-[11px] opacity-70 mt-1">{sub}</div>}
        </div>
    );
}
