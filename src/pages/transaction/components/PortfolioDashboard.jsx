import { useState } from 'react';
import { fmtUsd } from '../utils/formatters';
import { FmtAmount } from './TableCells';
import { TRADING_RULE_TITLE, TRADING_RULE_STEPS, TRADING_RULE_NOTES } from '@/util/TradingRule';

/**
 * 포트폴리오 요약 대시보드 (테이블 상단 배치)
 */
export function PortfolioDashboard({ buySum, curSum, diff, diffPct, fx, fxUpdatedAt, lastUpdated }) {
    const [showInfo, setShowInfo] = useState(false);
    const [showRule, setShowRule] = useState(false);
    const isProfit = diff >= 0;

    return (
        <div className="mb-4 px-2 md:px-4 space-y-3">
            {/* 4개 카드 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 총 투자금액 */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">총 투자금액</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
                        <FmtAmount text={`$ ${fmtUsd(buySum)}`} />
                    </div>
                    {fx > 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            ≈ ₩{Math.round(buySum * fx).toLocaleString()}
                        </div>
                    )}
                </div>

                {/* 총 평가금액 */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">총 평가금액</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
                        <FmtAmount text={`$ ${fmtUsd(curSum)}`} />
                    </div>
                    {fx > 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            ≈ ₩{Math.round(curSum * fx).toLocaleString()}
                        </div>
                    )}
                </div>

                {/* 총 손익 */}
                <div className={`border rounded-xl p-4 shadow-sm ${
                    isProfit
                        ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/30 dark:border-rose-800'
                        : 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800'
                }`}>
                    <div className="text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">총 손익</div>
                    <div className={`text-lg font-bold tabular-nums ${isProfit ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        <FmtAmount text={`${isProfit ? '+' : ''}$ ${fmtUsd(diff)}`} />
                    </div>
                    {fx > 0 && (
                        <div className={`text-xs tabular-nums mt-0.5 ${isProfit ? 'text-rose-600/80 dark:text-rose-400/80' : 'text-blue-600/80 dark:text-blue-400/80'}`}>
                            {isProfit ? '+' : ''}₩{Math.round(diff * fx).toLocaleString()}
                        </div>
                    )}
                    <div className={`text-sm font-semibold tabular-nums ${isProfit ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {isProfit ? '+' : ''}{diffPct.toFixed(2)}%
                    </div>
                </div>

                {/* 환율 정보 */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">환율 정보</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
                        {fx ? `₩${Number(fx).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {fxUpdatedAt ? `갱신: ${fxUpdatedAt.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                    </div>
                </div>
            </div>

            {/* 매매 원칙 토글 (참고용, util/TradingRule) */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                    onClick={() => setShowRule(!showRule)}
                    aria-expanded={showRule}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="font-medium">{TRADING_RULE_TITLE}</span>
                    <svg className={`w-4 h-4 ml-auto transition-transform ${showRule ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {showRule && (
                    <div className="px-4 pb-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-2">
                        <ol className="list-decimal pl-4 space-y-0.5 text-slate-700 dark:text-slate-300">
                            {TRADING_RULE_STEPS.map((step) => <li key={step}>{step}</li>)}
                        </ol>
                        <ul className="mt-2 space-y-0.5">
                            {TRADING_RULE_NOTES.map((note) => <li key={note}>• {note}</li>)}
                        </ul>
                    </div>
                )}
            </div>

            {/* 정보 안내 토글 */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                    onClick={() => setShowInfo(!showInfo)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">계산 기준 안내</span>
                    <svg className={`w-4 h-4 ml-auto transition-transform ${showInfo ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {showInfo && (
                    <div className="px-4 pb-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-2">
                        <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">이 페이지는 순수 주가 변동만 계산합니다.</p>
                        <p className="mb-1">증권사 앱과 차이가 날 수 있는 이유: 현재가 갱신 시점 차이, 매매/환전 수수료 미반영, 증권사별 환율 차이</p>
                        <p>• 환율 기준: 매수가격(₩), 총매수금액(₩)은 <strong>매수당시 환율</strong> 기준 / 나머지 원화 표시는 <strong>현재 환율</strong> 기준</p>
                    </div>
                )}
            </div>
        </div>
    );
}
