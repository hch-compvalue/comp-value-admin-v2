/**
 * 한 달 예상 움직임 (투자 판단 상세 · 기업가치 계산 결과 모달 공용)
 * - 2026-10-19 검증(test/backtest-sr-2026-10): 지지/저항선은 근거 없음 → 현재가 ± 2·ATR 범위를 평이한 문장으로 표시
 * - 확률은 모든 종목 공통 평균(방향 신호 아님) → '자세히 보기' 안에만
 * - entryTiming에 range 필드가 없으면(구 평가 데이터) 아무것도 그리지 않음
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { RANGE_TITLE, RANGE_SOURCE_NOTE, PCT, hasPriceRange, fmtProb, fmtUsd2 } from './priceRangeUtil';


/** 진입 타이밍 — 한 달 예상 움직임 (평이한 표현, 확률·용어는 '자세히 보기' 안) */
export const PriceRangeBlock = ({ entryTiming: et, currentPrice, stopLoss }) => {
    const [showDetail, setShowDetail] = useState(false);
    if (!hasPriceRange(et)) return null;
    const price = isNaN(currentPrice) ? (et.rangeLow + et.rangeHigh) / 2 : currentPrice;
    const pos = Math.max(0, Math.min(PCT, ((price - et.rangeLow) / (et.rangeHigh - et.rangeLow)) * PCT));
    const atrPct = price > 0 && et.atr ? (et.atr / price) * PCT : null;
    const stopInRange = !isNaN(stopLoss) && stopLoss > et.rangeLow && stopLoss < price;
    return (
        <div className="mb-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-600 p-3">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">{RANGE_TITLE}</div>
            <div className="relative h-2 mt-3 rounded-full bg-slate-200 dark:bg-slate-600">
                <div className="absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-700 dark:border-white dark:bg-slate-800 shadow"
                     style={{ left: `${pos}%`, top: '50%', transform: 'translate(-50%, -50%)' }} title={`현재가 ${fmtUsd2(price)}`} />
            </div>
            <div className="flex justify-between items-baseline mt-1.5 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{fmtUsd2(et.rangeLow)}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">현재 {fmtUsd2(price)}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{fmtUsd2(et.rangeHigh)}</span>
            </div>
            <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                이 종목은 한 달({et.rangeDays}거래일) 동안 보통 이 범위에서 움직입니다.
            </div>
            {stopInRange && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>손절매가({fmtUsd2(stopLoss)})가 이 범위 안이에요 — 평소 흔들림에도 손절될 수 있습니다.</span>
                </div>
            )}
            <button type="button" onClick={() => setShowDetail((v) => !v)}
                    className="mt-1.5 text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                자세히 보기 {showDetail ? '▲' : '▼'}
            </button>
            {showDetail && (
                <div className="mt-1.5 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <div>범위 = 현재가 ± 하루 평균 변동폭(ATR {fmtUsd2(et.atr)}{atrPct != null ? `, ${atrPct.toFixed(1)}%` : ''})의 {et.rangeAtrMultiple}배</div>
                    {et.rangeProbTable?.length > 0 && (
                        <>
                            <div>한 달 안에 그 가격을 종가로 넘어설 확률 — <b>모든 종목 공통 평균</b>이며 오를지 내릴지 알려주는 신호가 아닙니다.</div>
                            <table className="w-full text-slate-600 dark:text-slate-300">
                                <thead>
                                    <tr className="text-slate-400 dark:text-slate-500">
                                        <th className="text-left font-normal py-0.5">현재가에서</th>
                                        <th className="text-right font-normal">아래 가격</th>
                                        <th className="text-right font-normal">내려갈 확률</th>
                                        <th className="text-right font-normal">위 가격</th>
                                        <th className="text-right font-normal">올라갈 확률</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {et.rangeProbTable.map((r) => (
                                        <tr key={r.atrMultiple} className="border-t border-slate-100 dark:border-slate-700">
                                            <td className="py-0.5">± ATR {r.atrMultiple}배</td>
                                            <td className="text-right">{fmtUsd2(Math.max(0, price - r.atrMultiple * et.atr))}</td>
                                            <td className="text-right">{fmtProb(r.down)}</td>
                                            <td className="text-right">{fmtUsd2(price + r.atrMultiple * et.atr)}</td>
                                            <td className="text-right">{fmtProb(r.up)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                    <div>{RANGE_SOURCE_NOTE}. 지지·저항선은 검증에서 근거가 없어 표시하지 않습니다.</div>
                </div>
            )}
        </div>
    );
};

export default PriceRangeBlock;
