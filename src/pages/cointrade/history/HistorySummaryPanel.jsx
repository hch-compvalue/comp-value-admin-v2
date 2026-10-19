import { Link } from 'react-router-dom';
import { TRADE_DASHBOARD_PATH } from '@/config/menuPaths';
import {
    MARKET, MARKET_META, DASHBOARD_TAB_BY_MARKET, tabMarket, isLegacyRecord,
    computeFlow, computeFlowByMarket, computeLegacyStats,
} from './historyCommon';

const fmtWon = (v) => `${Math.floor(v || 0).toLocaleString('en-US')}원`;
const fmtSignedWon = (v) => `${(v || 0) >= 0 ? '+' : ''}${fmtWon(v)}`;

// 구 전략 사유 카드 색상 (적록색약 — 이익 sky/blue, 손실 orange, 기타 amber/purple)
const LEGACY_REASON_TONE = {
    takeProfit: { box: 'bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800', text: 'text-sky-700 dark:text-sky-400', value: 'text-sky-800 dark:text-sky-300' },
    stopLoss: { box: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', value: 'text-orange-800 dark:text-orange-300' },
    trailingStop: { box: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', value: 'text-amber-800 dark:text-amber-300' },
    maxHoldExpired: { box: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', value: 'text-amber-800 dark:text-amber-300' },
    manual: { box: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', value: 'text-orange-800 dark:text-orange-300' },
    expired: { box: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-400', value: 'text-purple-800 dark:text-purple-300' },
};

const TONE = {
    buy: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-300',
    neutral: 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200',
    profit: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-300',
    loss: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800 text-orange-800 dark:text-orange-300',
    note: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-800 dark:text-amber-300',
};

const StatBox = ({ label, value, sub, tone = 'neutral' }) => (
    <div className={`p-4 rounded-lg border ${TONE[tone]}`}>
        <div className="text-xs opacity-80 mb-1">{label}</div>
        <div className="text-lg font-bold">{value}</div>
        {sub && <div className="text-[10px] opacity-70 mt-1">{sub}</div>}
    </div>
);

export const MarketBadge = ({ market }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${MARKET_META[market].badge}`}>
        {MARKET_META[market].label}
    </span>
);

/** 매수/매도/순매수 카드 묶음 */
const FlowCards = ({ flow, cols = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5' }) => (
    <div className={`grid ${cols} gap-3`}>
        <StatBox label="매수 건수" value={`${flow.buyCount}건`} tone="buy" />
        <StatBox label="매수 금액" value={fmtWon(flow.buyAmount)} tone="buy" />
        <StatBox label="매도 건수" value={`${flow.sellCount}건`} />
        <StatBox label="매도 금액" value={fmtWon(flow.sellAmount)} />
        <StatBox label="순매수 (매수-매도)" value={fmtSignedWon(flow.netBuy)} tone="note" />
    </div>
);

/** 전략 수익률은 자동매매 화면 원장에서 확인 — 안내 + 바로가기 */
const StrategyReturnNote = ({ market }) => {
    const markets = market ? [market] : [MARKET.CRYPTO, MARKET.KRX];
    return (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            추세 전략은 건별 손익을 기록하지 않습니다. 전략 수익률은{' '}
            {markets.map((m, i) => (
                <span key={m}>
                    {i > 0 && ' · '}
                    <Link
                        to={TRADE_DASHBOARD_PATH}
                        state={{ tab: DASHBOARD_TAB_BY_MARKET[m] }}
                        className="text-sky-600 dark:text-sky-400 hover:underline font-medium"
                    >
                        자동매매({MARKET_META[m].label})
                    </Link>
                </span>
            ))}{' '}
            화면에서 확인하세요.
        </p>
    );
};

/** 현재 전략 흐름 요약 — 전체 탭은 코인/주식 분리 표시 */
const CurrentFlowSection = ({ rows, market }) => {
    if (market) return <FlowCards flow={computeFlow(rows)} />;
    const byMarket = computeFlowByMarket(rows);
    return (
        <div className="space-y-4">
            <FlowCards flow={computeFlow(rows)} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[MARKET.CRYPTO, MARKET.KRX].map((m) => (
                    <div key={m} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <MarketBadge market={m} />
                            <span className="text-xs text-slate-500 dark:text-slate-400">{byMarket[m].count}건</span>
                        </div>
                        <FlowCards flow={byMarket[m]} cols="grid-cols-2 md:grid-cols-3" />
                    </div>
                ))}
            </div>
        </div>
    );
};

/** 구 전략(v4 단타) 손익 요약 — 구 전략 기록만 집계 */
const LegacySection = ({ rows }) => {
    const s = computeLegacyStats(rows);
    const profitTone = (v) => (v >= 0 ? 'profit' : 'loss');
    return (
        <div className="mt-6 pt-4 border-t border-dashed border-slate-300 dark:border-slate-600">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                구 전략(v4 단타) 기록
                <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{s.count}건 · 구 전략 기록만 집계</span>
            </h3>
            {s.count === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">조회 기간에 구 전략 기록이 없습니다.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <StatBox label="매수 건수" value={`${s.buyCount}건`} tone="buy" />
                        <StatBox label="매도 건수" value={`${s.sellCount}건`} />
                        <StatBox label="매도 금액" value={fmtWon(s.sellAmount)} />
                        <StatBox label="승률" value={`${s.winRate.toFixed(1)}%`} sub={`${s.winCount} / ${s.sellCount}건`} tone="note" />
                        <StatBox label="실현 손익" value={fmtSignedWon(s.totalProfit)} tone={profitTone(s.totalProfit)} />
                        <StatBox
                            label="실현 수익률"
                            value={`${s.realizedProfitRate >= 0 ? '+' : ''}${s.realizedProfitRate.toFixed(2)}%`}
                            sub="매도 실현 손익 / 매도 원금"
                            tone={profitTone(s.realizedProfitRate)}
                        />
                    </div>
                    <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                        매도 사유별 건수 · 비율 · 손익
                        <span className="ml-2 font-normal text-[10px] text-slate-400 dark:text-slate-500">(비율은 구 전략 매도 {s.sellCount}건 대비)</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {s.reasons.map(({ key, label, count, amount }) => {
                            const tone = LEGACY_REASON_TONE[key];
                            const pct = s.sellCount > 0 ? (count / s.sellCount) * 100 : 0;
                            return (
                                <div key={key} className={`p-4 rounded-lg border ${tone.box}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs ${tone.text}`}>{label}</span>
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-900/40 ${tone.text}`}>
                                            {pct.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className={`text-xl font-bold ${tone.value}`}>{count}건</div>
                                    <div className={`text-xs mt-1 font-medium ${amount >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                                        {count === 0 ? <span className="text-slate-400 dark:text-slate-500">-</span> : fmtSignedWon(amount)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

/**
 * 조회 결과 요약 본문 (전체 보기 조회 시)
 * - 현재 전략: 선택 탭 시장의 매수/매도/순매수 (전체 탭은 코인·주식 분리)
 * - 구 전략 포함 시: v4 단타 기록만 따로 승률·실현손익·사유별 집계
 */
export default function HistorySummaryPanel({ records, activeTab, includeLegacy }) {
    const market = tabMarket(activeTab);
    const currentRows = records.filter((r) => !isLegacyRecord(r));
    return (
        <>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                현재 전략 (추세 리밸런싱) · {currentRows.length}건
            </div>
            <CurrentFlowSection rows={currentRows} market={market} />
            <StrategyReturnNote market={market} />
            {includeLegacy && <LegacySection rows={records.filter(isLegacyRecord)} />}
        </>
    );
}
