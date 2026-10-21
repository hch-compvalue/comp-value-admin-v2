import { FmtAmount } from '../TableCells';
import { fmtMoney, fmtDate } from '../../utils/formatters';
import { HOLD_DEADLINE_MONTHS } from '@/util/TradingRule';

/** 손익 방향 색 — 국내 관행(상승 빨강 / 하락 파랑), 적록색약도 구분 가능한 조합 */
const TONE = {
    up: { text: 'text-rose-600 dark:text-rose-400', pill: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' },
    down: { text: 'text-blue-600 dark:text-blue-400', pill: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300' },
    flat: { text: 'text-slate-500 dark:text-slate-400', pill: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300' },
};
const toneOf = (v) => (v > 0 ? TONE.up : v < 0 ? TONE.down : TONE.flat);

const PCT_DIGITS = 2;
const FULL_PROGRESS = 100;
const clampPct = (v) => Math.max(0, Math.min(FULL_PROGRESS, v));
const fmtSignedPct = (v) => `${v > 0 ? '+' : ''}${v.toFixed(PCT_DIGITS)}%`;

/** 금액 (USD 는 소수부 흐리게, flex 안에서 쪼개지지 않게 span 으로 감쌈) */
export function Money({ usd, ctx, signed = false }) {
    return <span><FmtAmount text={fmtMoney(usd, ctx.currency, ctx.fx, { signed })} /></span>;
}

/** 전일 종가 대비 등락 */
export function DayChange({ pct }) {
    if (pct == null) return null;
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '–';
    return (
        <span className={`text-xs font-medium ${toneOf(pct).text}`} title="전일 종가 대비">
            {arrow}{Math.abs(pct).toFixed(PCT_DIGITS)}%
        </span>
    );
}

/** 목표가 진행률 — 회색 막대, 도달 시에만 호박색 (행 배경·왼쪽 강조선과 함께 '목표 도달' 표시) */
function TargetProgress({ progress }) {
    if (progress == null) return null;
    const hit = progress >= FULL_PROGRESS;
    const labelCls = hit
        ? 'font-semibold text-amber-600 dark:text-amber-400'
        : progress < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400';
    return (
        <div className="w-16 shrink-0 text-right" title="매수가 → 목표가 구간에서 현재가 위치">
            <div className={`text-[11px] ${labelCls}`}>목표 {Math.round(progress)}%</div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                    className={`h-full rounded-full ${hit ? 'bg-amber-400' : 'bg-slate-400 dark:bg-slate-500'}`}
                    style={{ width: `${clampPct(progress)}%` }}
                />
            </div>
        </div>
    );
}

function Tag({ children, className }) {
    return <span className={`rounded px-1.5 py-px text-[11px] font-medium ${className}`}>{children}</span>;
}

/** 종목 셀 — 합계 행은 펼치기 버튼 + 매수 건수, 개별 매수 행은 들여쓰기 + 매수 차수 */
export function SymbolCell({ m, ctx }) {
    const isGroup = m.kind === 'group';
    const isLot = m.kind === 'lot';
    const expanded = isGroup && ctx.expandedSymbols.has(m.symbol);

    return (
        <div className={`flex items-center gap-3 ${isLot ? 'pl-8' : ''}`}>
            {isGroup && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); ctx.onToggleGroup(m.symbol); }}
                    aria-expanded={expanded}
                    aria-label={`${m.symbol} 매수 ${m.lotCount}건 ${expanded ? '접기' : '펼치기'}`}
                    className="-ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                    <svg className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}
            <div className="min-w-0 flex-1">
                {isLot ? (
                    <div className="flex items-center gap-1.5 text-xs">
                        <span>{m.lotIndex}차 매수</span>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{m.symbol}</span>
                            {isGroup && <Tag className="bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">{m.lotCount}건</Tag>}
                        </div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400" title={m.companyName}>{m.companyName}</div>
                    </>
                )}
            </div>
            <TargetProgress progress={m.targetProgress} />
        </div>
    );
}

/** 평가금액 + 매수금액(보조) */
export function EvalAmountCell({ m, ctx }) {
    return (
        <div className="leading-tight">
            <div className="font-medium"><Money usd={m.evalAmount} ctx={ctx} /></div>
            <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">매수 <Money usd={m.buyAmount} ctx={ctx} /></div>
        </div>
    );
}

/** 손익 금액 + 수익률 배지 */
export function PnlCell({ m, ctx }) {
    const tone = toneOf(m.pnl);
    return (
        <span className="inline-flex items-center justify-end gap-2">
            <span className={`font-medium ${tone.text}`}><Money usd={m.pnl} ctx={ctx} signed /></span>
            <span className={`min-w-16 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold ${tone.pill}`}>{fmtSignedPct(m.pnlPct)}</span>
        </span>
    );
}

/** 현재가 (+ 전일 대비, 개별 매수 행은 합계 행과 같아 생략) */
export function CurPriceCell({ m, ctx }) {
    if (!m.curPrice) return null;
    return (
        <span className="inline-flex items-baseline gap-2">
            {m.kind !== 'lot' && <DayChange pct={m.dayChangePct} />}
            <Money usd={m.curPrice} ctx={ctx} />
        </span>
    );
}

/** 기한 줄 색 — 지남/임박만 호박색(목표 도달 표시와 같은 '매도 검토' 신호), 나머지 회색 */
function deadlineTone(hold) {
    if (hold.expired) return 'font-semibold text-amber-600 dark:text-amber-400';
    if (hold.soon) return 'text-amber-600 dark:text-amber-400';
    return 'text-slate-400 dark:text-slate-500';
}

function deadlineText(hold) {
    if (hold.expired) return `기한 지남 · ${fmtDate(hold.deadline)}`;
    if (hold.soon) return `기한 ${fmtDate(hold.deadline)} (D-${hold.daysLeft})`;
    return `기한 ${fmtDate(hold.deadline)}`;
}

/**
 * 매수일 + 경과 개월 / 매도 기한(매수 후 HOLD_DEADLINE_MONTHS개월)
 * - 합계 행: 가장 먼저 산 건 기준 (가장 먼저 기한이 옴)
 */
export function BuyDateCell({ m }) {
    const { hold } = m;
    const isGroup = m.kind === 'group';
    return (
        <div
            className="leading-tight"
            title={hold ? `매수 후 ${HOLD_DEADLINE_MONTHS}개월이 지나면 목표가 미도달이어도 매도 검토${isGroup ? ' (가장 먼저 산 건 기준)' : ''}` : undefined}
        >
            <div className="text-slate-500 dark:text-slate-400">
                {isGroup ? (hold ? `최초 ${fmtDate(m.holdFrom)}` : '') : fmtDate(m.buyDate)}
                {hold && <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">({hold.months}개월)</span>}
            </div>
            {hold && <div className={`mt-0.5 text-xs ${deadlineTone(hold)}`}>{deadlineText(hold)}</div>}
        </div>
    );
}

/**
 * 메모 — 종목 메모(합계·단일 행)와 매수 비고(단일·펼친 개별 행)를 구분해 표시
 * - 합계 행: 종목 메모 / 단일 행: 종목 메모 + 매수 비고(보조) / 개별 매수 행: 매수 비고
 */
export function MemoCell({ m, ctx }) {
    const symbolMemo = m.kind === 'lot' ? '' : ctx.getMemo(m.symbol);
    const lotRmk = m.kind === 'group' ? '' : (m.rmk || '');
    return (
        <div className="leading-tight">
            {symbolMemo && <div className="truncate text-xs text-slate-700 dark:text-slate-200" title={symbolMemo}>{symbolMemo}</div>}
            {lotRmk && <div className="truncate text-xs text-slate-400 dark:text-slate-500" title={lotRmk}>{lotRmk}</div>}
        </div>
    );
}
