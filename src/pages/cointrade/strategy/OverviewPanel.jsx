import { useMemo } from 'react';
import {
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { Card, Row, ErrorBanner, RefreshButton } from './StrategyUi';
import useOverviewData from './useOverviewData';
import { STRATEGY_COIN, STRATEGY_STOCK, modeLabel, fmtKrw, fmtPct, fmtSignedPct, fmtBtc, fmtShares, fmtDateTime } from './strategyCommon';
import { SLATE, withAlpha } from '@/config/themeColors';

/**
 * 자동매매 전체 탭 — 코인·주식 실전(LIVE) 장부 합산 현황
 * 색상: 적록색약 배려 — 코인 파랑 계열 · 주식 노랑/주황 계열, 수익 파랑 · 손실/낙폭 주황 (빨강↔초록 사용 안 함)
 */

const MARKET_CRYPTO = 'CRYPTO';
const MARKET_KRX = 'KRX';

/** 전략 id → 상세 탭 key (CointradeStrategy TABS) */
const STRATEGY_TAB = { [STRATEGY_COIN]: 'coin', [STRATEGY_STOCK]: 'stock' };

/** 시장별 색: 보유 종목은 진한 톤 순환, 현금은 옅은 톤 */
const MARKET_PALETTE = {
    [MARKET_CRYPTO]: { label: '코인', assets: ['#2563eb', '#1e40af', '#60a5fa'], cash: '#bfdbfe', line: '#3b82f6',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    [MARKET_KRX]: { label: '주식', assets: ['#f59e0b', '#ea580c', '#b45309'], cash: '#fde68a', line: '#f59e0b',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};
const FALLBACK_COLOR = SLATE[400];
const COLOR_TOTAL_LINE = SLATE[500];
const COLOR_DRAWDOWN = '#f97316';
const DRAWDOWN_FILL_ALPHA = 35;

const MODE_BADGE = {
    LIVE: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300',
    DRY_RUN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    OFF: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
};

const PROFIT_TEXT = 'text-blue-600 dark:text-blue-400';
const LOSS_TEXT = 'text-orange-500 dark:text-orange-400';
const returnAccent = (v) => (v === null || v === undefined ? undefined : v >= 0 ? PROFIT_TEXT : LOSS_TEXT);

const PERCENT = 100;
const KRW_PER_MAN = 10_000;
const DATE_LABEL_START = 5;            // 'YYYY-MM-DD' → 'MM-DD'
const DOT_MAX_POINTS = 10;             // 점이 적을 때만 점 표시 (1~2일 기록도 보이도록)
const EQUITY_AXIS_PAD = 0.02;          // 평가금액 축 위아래 여유 (2%)
const MIN_DRAWDOWN_AXIS_PCT = -1;      // 낙폭이 0뿐일 때도 축이 납작해지지 않도록
const PIE_INNER_RADIUS = '58%';
const PIE_OUTER_RADIUS = '88%';
const TOOLTIP_Z_INDEX = 10;            // 도넛 가운데 '총 평가금액' 문구보다 위

const fmtMan = (v) => `${Math.round(v / KRW_PER_MAN).toLocaleString('ko-KR')}만`;
const fmtSignedKrw = (v) => (v === null || v === undefined ? '-' : `${v >= 0 ? '+' : ''}${fmtKrw(v)}`);
const isCash = (item) => /cash/i.test(item.key || '') || (item.label || '').includes('현금');
const fmtUnits = (market, units) => (market === MARKET_CRYPTO ? fmtBtc(units) : fmtShares(units));

/** 자산 구성 항목에 시장별 색 지정 (현금은 옅은 톤, 보유 종목은 시장 팔레트 순환) */
const colorizeAllocation = (items) => {
    const used = {};
    return items.map((item) => {
        const palette = MARKET_PALETTE[item.market];
        if (!palette) return { ...item, color: FALLBACK_COLOR };
        if (isCash(item)) return { ...item, color: palette.cash };
        const idx = used[item.market] || 0;
        used[item.market] = idx + 1;
        return { ...item, color: palette.assets[idx % palette.assets.length] };
    });
};

const Kpi = ({ label, value, sub, accent }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`mt-1 text-xl font-semibold ${accent || 'text-slate-900 dark:text-white'}`}>{value}</p>
        {sub && <p className={`mt-0.5 text-xs ${accent || 'text-slate-500 dark:text-slate-400'}`}>{sub}</p>}
    </div>
);

const Badge = ({ className, children }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>{children}</span>
);

const TooltipBox = ({ title, children }) => (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">{title}</p>
        {children}
    </div>
);

const TooltipLine = ({ color, label, value }) => (
    <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            {color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}{label}
        </span>
        <span className="font-medium text-slate-800 dark:text-slate-100">{value}</span>
    </div>
);

const AllocationTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
        <TooltipBox title={item.label}>
            <TooltipLine label="금액" value={fmtKrw(item.valueKrw)} />
            <TooltipLine label="비중" value={fmtPct(item.weight)} />
        </TooltipBox>
    );
};

const EquityTooltip = ({ active, payload, lines }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
        <TooltipBox title={row.fullDate}>
            <TooltipLine color={COLOR_TOTAL_LINE} label="합계 평가금액" value={fmtKrw(row.total)} />
            {lines.map((l) => (
                row[l.id] !== undefined && <TooltipLine key={l.id} color={l.color} label={l.name} value={fmtKrw(row[l.id])} />
            ))}
            {row.cumReturn !== null && (
                <TooltipLine label="누적 수익률" value={<span className={returnAccent(row.cumReturn)}>{fmtSignedPct(row.cumReturn)}</span>} />
            )}
        </TooltipBox>
    );
};

const DrawdownTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
        <TooltipBox title={row.fullDate}>
            <TooltipLine color={COLOR_DRAWDOWN} label="고점 대비 낙폭" value={fmtPct(row.drawdown, 2)} />
        </TooltipBox>
    );
};

/** 자산 구성 도넛 + 범례 목록 */
const AllocationCard = ({ allocation, totalEquity }) => {
    const items = useMemo(() => colorizeAllocation(allocation || []), [allocation]);
    const pieItems = items.filter((i) => i.valueKrw > 0);
    return (
        <Card title="자산 구성">
            {pieItems.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="relative h-56">
                        {/* 가운데 문구는 차트보다 먼저 그려 툴팁이 그 위에 오게 한다 */}
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xs text-slate-500 dark:text-slate-400">총 평가금액</span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">{fmtKrw(totalEquity)}</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieItems} dataKey="valueKrw" nameKey="label" innerRadius={PIE_INNER_RADIUS} outerRadius={PIE_OUTER_RADIUS}
                                    paddingAngle={1} stroke="none" isAnimationActive={false}>
                                    {pieItems.map((i) => <Cell key={i.key} fill={i.color} />)}
                                </Pie>
                                <Tooltip content={<AllocationTooltip />} wrapperStyle={{ zIndex: TOOLTIP_Z_INDEX }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <ul className="space-y-1.5">
                        {items.map((i) => (
                            <li key={i.key} className="flex items-center justify-between gap-2 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: i.color }} />
                                    <span className="truncate text-slate-700 dark:text-slate-300" title={i.label}>{i.label}</span>
                                </span>
                                <span className="shrink-0 text-right">
                                    <span className="font-medium text-slate-800 dark:text-slate-100">{fmtKrw(i.valueKrw)}</span>
                                    <span className="ml-2 inline-block w-12 text-xs text-slate-500 dark:text-slate-400">{fmtPct(i.weight)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : <p className="text-sm text-slate-400">실전 장부가 없어 표시할 자산이 없습니다.</p>}
        </Card>
    );
};

/** 전략 1개 요약 카드 (보유 종목 + 상세 탭 이동) */
const StrategyCard = ({ strategy: s, onSelectTab }) => {
    const palette = MARKET_PALETTE[s.market];
    const tabKey = STRATEGY_TAB[s.id];
    const profit = s.equityKrw !== undefined && s.equityKrw !== null && s.capitalKrw !== undefined && s.capitalKrw !== null
        ? s.equityKrw - s.capitalKrw : null;
    const holdings = s.holdings || [];
    return (
        <Card
            title={(
                <span className="flex items-center gap-2">
                    {palette && <Badge className={palette.badge}>{palette.label}</Badge>}
                    <span>{s.name || s.id}</span>
                </span>
            )}
            right={<Badge className={MODE_BADGE[s.mode] || MODE_BADGE.OFF}>{modeLabel(s.mode) || s.mode}</Badge>}
        >
            {s.live ? (
                <>
                    <Row label="평가금액" value={fmtKrw(s.equityKrw)} />
                    <Row label="투자금" value={fmtKrw(s.capitalKrw)} />
                    <Row label="현금" value={fmtKrw(s.cashKrw)} />
                    <Row label="수익률" value={profit === null ? fmtSignedPct(s.returnPct) : `${fmtSignedPct(s.returnPct)} (${fmtSignedKrw(profit)})`}
                        accent={returnAccent(s.returnPct)} />
                    <Row label="투자 비중 (현금 제외)" value={fmtPct(s.investedWeight)} />
                    <Row label="전체 대비 비중" value={fmtPct(s.shareOfTotal)} />
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">보유 종목</p>
                        {holdings.length ? (
                            <ul className="space-y-1.5">
                                {holdings.map((h) => (
                                    <li key={h.symbol} className="text-sm">
                                        <div className="flex justify-between gap-2">
                                            <span className="truncate text-slate-700 dark:text-slate-300" title={`${h.name} · ${h.symbol}`}>{h.name || h.symbol}</span>
                                            <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100">{fmtKrw(h.valueKrw)}</span>
                                        </div>
                                        <div className="flex justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <span>{fmtUnits(s.market, h.units)}</span>
                                            {h.avgPrice !== null && h.avgPrice !== undefined && <span>평균 단가 {fmtKrw(h.avgPrice)}</span>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-sm text-slate-400">보유 종목 없음 (전액 현금)</p>}
                    </div>
                </>
            ) : <p className="text-sm text-slate-400">실전 장부 없음 (모드: {modeLabel(s.mode) || s.mode || '-'})</p>}
            {tabKey && onSelectTab && (
                <button type="button" onClick={() => onSelectTab(tabKey)}
                    className="mt-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                    {palette?.label || s.name} 탭에서 자세히 보기 →
                </button>
            )}
        </Card>
    );
};

/** 합산 평가금액 추이 + 고점 대비 낙폭 */
const HistoryCard = ({ history, strategies }) => {
    const lines = useMemo(() => {
        const ids = new Set((history || []).flatMap((h) => Object.keys(h.equityBy || {})));
        return (strategies || []).filter((s) => ids.has(s.id)).map((s) => ({
            id: s.id, name: s.name || s.id, color: MARKET_PALETTE[s.market]?.line || FALLBACK_COLOR,
        }));
    }, [history, strategies]);

    const rows = useMemo(() => (history || []).map((h) => ({
        fullDate: h.date,
        date: h.date?.slice(DATE_LABEL_START),
        total: h.totalEquityKrw,
        ...h.equityBy,
        cumReturn: h.index === null || h.index === undefined ? null : h.index - 1,
        drawdown: h.drawdown,
        drawdownPct: h.drawdown === null || h.drawdown === undefined ? null : +(h.drawdown * PERCENT).toFixed(2),
    })), [history]);

    if (!rows.length) {
        return <Card title="합산 추이"><p className="text-sm text-slate-400">실전 장부 실행 기록이 쌓이면 표시됩니다.</p></Card>;
    }
    const showDot = rows.length <= DOT_MAX_POINTS;
    const grid = <CartesianGrid strokeDasharray="3 3" stroke={withAlpha(SLATE[400], 20)} />;
    return (
        <Card title="합산 추이" right={<span className="text-xs text-slate-400">{rows.length}일 · 매일 실행 시점</span>}>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows} syncId="overview-history">
                        {grid}
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={fmtMan} tick={{ fontSize: 11 }} width={56}
                            domain={[(min) => Math.floor(min * (1 - EQUITY_AXIS_PAD)), (max) => Math.ceil(max * (1 + EQUITY_AXIS_PAD))]} />
                        <Tooltip content={<EquityTooltip lines={lines} />} />
                        <Legend />
                        <Line type="monotone" dataKey="total" name="합계" stroke={COLOR_TOTAL_LINE} strokeWidth={2.5} dot={showDot} isAnimationActive={false} />
                        {lines.map((l) => (
                            <Line key={l.id} type="monotone" dataKey={l.id} name={l.name} stroke={l.color} strokeWidth={2}
                                strokeDasharray="5 3" dot={showDot} connectNulls isAnimationActive={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <p className="mt-3 mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">고점 대비 낙폭 (합산)</p>
            <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rows} syncId="overview-history">
                        {grid}
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={56}
                            domain={[(min) => Math.min(min, MIN_DRAWDOWN_AXIS_PCT), 0]} />
                        <Tooltip content={<DrawdownTooltip />} />
                        <Area type="monotone" dataKey="drawdownPct" name="낙폭" stroke={COLOR_DRAWDOWN} fill={withAlpha(COLOR_DRAWDOWN, DRAWDOWN_FILL_ALPHA)}
                            dot={showDot} isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default function OverviewPanel({ header, onSelectTab }) {
    const { overview, fetchError, refreshing, refresh } = useOverviewData();

    const headerRow = (
        <div className="flex items-center justify-between gap-2">
            {header}
            <RefreshButton onClick={refresh} refreshing={refreshing} />
        </div>
    );
    const errors = [...(fetchError ? [fetchError] : []), ...(overview?.errors || [])];

    if (!overview) {
        return (
            <div className="space-y-4">
                {headerRow}
                <ErrorBanner errors={errors} />
                {!fetchError && <p className="text-sm text-slate-500">불러오는 중...</p>}
            </div>
        );
    }

    const total = overview.total || {};
    const profit = total.equityKrw !== undefined && total.equityKrw !== null && total.capitalKrw !== undefined && total.capitalKrw !== null
        ? total.equityKrw - total.capitalKrw : null;

    return (
        <div className="space-y-4">
            {headerRow}

            <ErrorBanner errors={errors} />

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Kpi label="총 평가금액" value={fmtKrw(total.equityKrw)} sub={`기준 ${fmtDateTime(overview.now)}`} />
                <Kpi label="총 투자금" value={fmtKrw(total.capitalKrw)} />
                <Kpi label="총 수익률" value={fmtSignedPct(total.returnPct)} sub={fmtSignedKrw(profit)} accent={returnAccent(total.returnPct)} />
                <Kpi label="현금 비중" value={fmtPct(total.cashWeight)} sub={fmtKrw(total.cashKrw)} />
                <Kpi label="최대 낙폭 (합산)" value={fmtPct(total.maxDrawdown, 2)} accent={total.maxDrawdown < 0 ? LOSS_TEXT : undefined} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <AllocationCard allocation={overview.allocation} totalEquity={total.equityKrw} />
                {(overview.strategies || []).map((s) => <StrategyCard key={s.id} strategy={s} onSelectTab={onSelectTab} />)}
            </div>

            <HistoryCard history={overview.history} strategies={overview.strategies} />

            <p className="text-[11px] text-slate-400">
                수익률은 실전 장부 기준(보유 종목 평가손익 포함)입니다. 추이는 매일 실행 시점의 평가금액이며,
                투자금을 늘린 날의 증가분은 수익으로 계산하지 않습니다.
            </p>
        </div>
    );
}
