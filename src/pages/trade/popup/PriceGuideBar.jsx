/**
 * 트레이딩 가이드 가격 막대 (투자 판단 상세 · 기업가치 계산 결과 모달 공용)
 * - 막대 범위 = 표시할 가격들(손절·매수적정·목표매도·적정가·현재가·한 달 예상 움직임)의 최솟값~최댓값
 *   (예전엔 '왼쪽=손절매가, 오른쪽=적정가' 고정이라 고평가 종목에서 현재가가 끝에 붙거나 '적정가' 글자가 엉뚱한 자리에 있었음)
 * - 적정가는 ◆ 표시, 끝 글자 대신 범례. 배경은 중립색(순서가 바뀌면 좋음/나쁨 그라데이션이 틀어지므로)
 * - 색: 적록색약 배려 (주황·하늘·파랑·보라)
 */
import { RANGE_TITLE } from './priceRangeUtil';

const BAR_PADDING_RATIO = 0.03;
const PCT = 100;

const TICKS = [
    { key: 'stop', label: '손절매가', color: '#f97316', tip: 'bg-orange-700', arrow: 'border-t-orange-700', z: 13 },
    { key: 'purchase', label: '매수적정가', color: '#0ea5e9', tip: 'bg-sky-700', arrow: 'border-t-sky-700', z: 14 },
    { key: 'sell', label: '목표매도가', color: '#3b82f6', tip: 'bg-blue-700', arrow: 'border-t-blue-700', z: 15 },
];
const FAIR = { label: '적정가', color: '#8b5cf6' };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// show: 'group-hover/x:opacity-100 group-hover/x:visible' 처럼 완성된 클래스 (Tailwind는 조합 문자열을 생성하지 않음)
const Tooltip = ({ show, bg, arrow, children }) => (
    <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2.5 py-1.5 ${bg} text-white text-[11px] font-medium rounded shadow-lg opacity-0 invisible ${show} transition-all whitespace-nowrap z-50 pointer-events-none`}>
        {children}
        <div className={`absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${arrow}`} />
    </div>
);

const PriceGuideBar = ({ price, stopLoss, purchase, sell, fair, rangeLow, rangeHigh, formatPrice }) => {
    if (!isNum(price)) return null;
    const values = { stop: stopLoss, purchase, sell };
    const hasRange = isNum(rangeLow) && isNum(rangeHigh) && rangeHigh > rangeLow;
    const all = [price, stopLoss, purchase, sell, fair, hasRange ? rangeLow : NaN, hasRange ? rangeHigh : NaN].filter(isNum);
    const lo = Math.min(...all), hi = Math.max(...all);
    if (!(hi > lo)) return null;
    const pad = (hi - lo) * BAR_PADDING_RATIO;
    const min = lo - pad, max = hi + pad;
    const toPct = (v) => (isNum(v) ? ((v - min) / (max - min)) * PCT : null);
    const diff = (v) => (isNum(v) && price !== 0 ? ((v - price) / price) * PCT : null);
    const diffText = (v) => {
        const d = diff(v);
        return d == null ? '' : ` (${d >= 0 ? '+' : ''}${d.toFixed(1)}%)`;
    };
    const overFair = isNum(fair) && price > fair;

    return (
        <div className="mt-6 mb-2">
            <div className="relative h-2.5 rounded-full bg-slate-200 dark:bg-slate-600">
                {/* 한 달 예상 움직임 띠 */}
                {hasRange && (
                    <div className="group/rg absolute cursor-pointer rounded-sm border-2 border-slate-500/70 dark:border-slate-200/70 bg-white/35"
                         style={{ left: `${toPct(rangeLow)}%`, width: `${toPct(rangeHigh) - toPct(rangeLow)}%`, top: '-4px', bottom: '-4px', zIndex: 11 }}>
                        <Tooltip show="group-hover/rg:opacity-100 group-hover/rg:visible" bg="bg-slate-700" arrow="border-t-slate-700">
                            {RANGE_TITLE}: {formatPrice(rangeLow)} ~ {formatPrice(rangeHigh)} (한 달 동안 보통 이 범위에서 움직임)
                        </Tooltip>
                    </div>
                )}
                {/* 손절·매수적정·목표매도 (세로 막대) */}
                {TICKS.filter((t) => isNum(values[t.key])).map((t) => (
                    <div key={t.key} className="group/m absolute cursor-pointer"
                         style={{ left: `${toPct(values[t.key])}%`, top: '-5px', bottom: '-5px', width: '10px', transform: 'translateX(-50%)', zIndex: t.z }}>
                        <div className="absolute rounded-sm transition-all group-hover/m:scale-x-150 group-hover/m:opacity-100"
                             style={{ left: '3px', right: '3px', top: 0, bottom: 0, background: t.color, opacity: 0.9 }} />
                        <Tooltip show="group-hover/m:opacity-100 group-hover/m:visible" bg={t.tip} arrow={t.arrow}>
                            {t.label}: {formatPrice(values[t.key])}{diffText(values[t.key])}
                        </Tooltip>
                    </div>
                ))}
                {/* 적정가 (◆) */}
                {isNum(fair) && (
                    <div className="group/f absolute cursor-pointer"
                         style={{ left: `${toPct(fair)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '16px', height: '16px', zIndex: 16 }}>
                        <div className="absolute inset-0.5 transition-all group-hover/f:scale-125"
                             style={{ background: FAIR.color, transform: 'rotate(45deg)', border: '1.5px solid rgba(255,255,255,0.7)' }} />
                        <Tooltip show="group-hover/f:opacity-100 group-hover/f:visible" bg="bg-violet-700" arrow="border-t-violet-700">
                            {FAIR.label}: {formatPrice(fair)}{diffText(fair)}
                        </Tooltip>
                    </div>
                )}
                {/* 현재가 (●) */}
                <div className="group/c absolute cursor-pointer"
                     style={{ left: `${toPct(price)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '18px', height: '18px', zIndex: 20 }}>
                    <div className="w-full h-full rounded-full bg-white border-2 border-slate-800 dark:border-white dark:bg-slate-800 shadow transition-all group-hover/c:scale-125" />
                    <Tooltip show="group-hover/c:opacity-100 group-hover/c:visible" bg="bg-slate-800" arrow="border-t-slate-800">현재가: {formatPrice(price)}</Tooltip>
                </div>
            </div>
            {/* 양 끝 가격 + 범례 */}
            <div className="flex justify-between mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                <span>{formatPrice(lo)}</span>
                <span>{formatPrice(hi)}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                {TICKS.filter((t) => isNum(values[t.key])).map((t) => (
                    <span key={t.key} className="inline-flex items-center gap-1">
                        <span className="inline-block w-1 h-2.5 rounded-sm" style={{ background: t.color }} />{t.label}
                    </span>
                ))}
                {isNum(fair) && (
                    <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rotate-45" style={{ background: FAIR.color }} />{FAIR.label}
                    </span>
                )}
                <span className="inline-flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-white border border-slate-700 dark:bg-slate-800 dark:border-white" />현재가
                </span>
                {hasRange && (
                    <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-2 rounded-sm border border-slate-500 bg-white/60" />{RANGE_TITLE}
                    </span>
                )}
            </div>
            {overFair && (
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    현재가가 적정가보다 {(((price - fair) / fair) * PCT).toFixed(1)}% 높아요
                </div>
            )}
        </div>
    );
};

export default PriceGuideBar;
