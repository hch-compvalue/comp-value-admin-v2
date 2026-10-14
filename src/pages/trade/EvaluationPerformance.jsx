import { useState, useCallback } from 'react';
import { send } from '@/util/ClientUtil';
import PageTitle from '@/component/common/display/PageTitle';
import EvaluationPerformanceHelpModal from '@/component/common/display/EvaluationPerformanceHelpModal';

const fmtPct = (v) => {
    if (v == null) return '-';
    const n = Number(v);
    const cls = n > 0 ? 'text-blue-600 dark:text-blue-400' : n < 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500';
    return <span className={`font-semibold ${cls}`}>{n > 0 ? '+' : ''}{n.toFixed(2)}%</span>;
};

// 기본 기준일: 7일 전
const defaultFrom = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
};

const COLUMNS = ['그룹', '종목수', '추적불가', '평균수익률', '중앙값', '승률', 'SPY 대비(평균)', 'SPY 대비(중앙)', 'SPY 이긴 비율', '최고', '최저'];

// 지수 대비 초과수익(%p) — 판정이 "그냥 SPY를 산 것"보다 나았는지
const fmtExcess = (v) => {
    if (v == null) return <span className="text-slate-400">-</span>;
    const n = Number(v);
    const cls = n > 0 ? 'text-blue-600 dark:text-blue-400' : n < 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500';
    return <span className={`font-semibold ${cls}`}>{n > 0 ? '+' : ''}{n.toFixed(2)}%p</span>;
};

/**
 * 추적불가 = 기준일엔 있었지만 수익률을 산출하지 못한 종목 수
 * 저평가 조건을 벗어날 만큼 오른 종목이 우선적으로 추천에서 빠지므로, 이 값이 크면 집계가 실제보다 보수적이다.
 */
const UntrackedCell = ({ unmatched = 0, noBasePrice = 0 }) => {
    const total = unmatched + noBasePrice;
    if (total === 0) return <span className="text-slate-400">-</span>;
    const detail = noBasePrice > 0
        ? `추천 이탈 ${unmatched}종목 + 기준가 없음 ${noBasePrice}종목`
        : `기준일 이후 추천 목록에서 빠져 수익률 산출 불가 ${unmatched}종목`;
    return <span className="font-semibold text-amber-600 dark:text-amber-400" title={detail}>{total}</span>;
};

const SummaryTable = ({ title, data }) => (
    <div className="mb-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                        {COLUMNS.map((h) => (
                            <th key={h} className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-right first:text-left whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {(!data || data.length === 0) && (
                        <tr><td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-slate-400">데이터 없음</td></tr>
                    )}
                    {data && data.map((s) => (
                        <tr key={s.group} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-2.5 text-left font-medium text-slate-800 dark:text-slate-100">{s.group}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {s.count}
                                {s.excludedCount > 0 && (
                                    <span
                                        className="ml-1.5 text-xs text-amber-600 dark:text-amber-400"
                                        title={`분할·병합 의심 또는 판별 불가로 ${s.excludedCount}종목 제외`}
                                    >
                                        (-{s.excludedCount})
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                                <UntrackedCell unmatched={s.unmatchedCount} noBasePrice={s.noBasePriceCount} />
                            </td>
                            {/* 집계 대상이 0종목이면 통계값이 없으므로 수치 대신 대시 표기 */}
                            <td className="px-4 py-2.5 text-right">{s.count > 0 ? fmtPct(s.avgReturnPct) : '-'}</td>
                            <td className="px-4 py-2.5 text-right">{s.count > 0 ? fmtPct(s.medianReturnPct) : '-'}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{s.count > 0 && s.winRatePct != null ? `${s.winRatePct.toFixed(0)}%` : '-'}</td>
                            <td className="px-4 py-2.5 text-right">{s.count > 0 ? fmtExcess(s.excessAvgReturnPct) : '-'}</td>
                            <td className="px-4 py-2.5 text-right">{s.count > 0 ? fmtExcess(s.excessMedianReturnPct) : '-'}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{s.count > 0 && s.beatBenchmarkPct != null ? `${s.beatBenchmarkPct.toFixed(0)}%` : '-'}</td>
                            <td className="px-4 py-2.5 text-right">{s.count > 0 ? fmtPct(s.maxReturnPct) : '-'}</td>
                            <td className="px-4 py-2.5 text-right">{s.count > 0 ? fmtPct(s.minReturnPct) : '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

/**
 * 성과 추적 (2-4)
 * 기준일의 투자판정/가치등급/추천프로파일별 이후 실제 수익률 집계 — "매수후보가 관망보다 실제 수익 높은가"
 */
const EvaluationPerformance = () => {
    const [fromDate, setFromDate] = useState(defaultFrom());
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        const { data, error } = await send(`/dart/main/evaluation/performance?from=${fromDate}`, null, 'GET');
        if (error) { setError(error); setResult(null); }
        else setResult(data?.response || null);
        setLoading(false);
    }, [fromDate]);

    return (
        <div className="p-4 md:p-6">
            <div className="flex items-start justify-between gap-3">
                <PageTitle />
                <button
                    type="button"
                    onClick={() => setIsHelpModalOpen(true)}
                    className="mt-1 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="성과 추적 페이지 설명"
                    aria-label="성과 추적 페이지 설명"
                >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold">?</span>
                    페이지 설명
                </button>
            </div>

            <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">기준일 (이 날짜의 판정이 이후 낸 수익률)</label>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    />
                </div>
                <button
                    onClick={fetchData}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={loading}
                >
                    {loading ? '조회 중…' : '조회'}
                </button>
            </div>

            {error && (
                <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-4 py-3 text-sm">{error}</div>
            )}

            {result && (
                <>
                    <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                        기준일 {result.baseDate || '-'} → 최신일 {result.latestDate || '-'}
                        {result.largeMoveThresholdPct != null && (
                            <span className="ml-2">· ±{result.largeMoveThresholdPct.toFixed(0)}% 초과 변동은 발행주식수·적정가로 분할·병합 여부를 판별</span>
                        )}
                        {result.note && <span className="ml-2 text-amber-600 dark:text-amber-400">· {result.note}</span>}
                    </div>

                    {/* 비교 기준 — 판정이 지수 매수보다 나은지가 핵심 (SPY 대비 열이 + 여야 판정이 의미 있음) */}
                    {!result.note && (
                        <div className="mb-4 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                            같은 기간 <strong>{result.benchmarkSymbol || 'SPY'}</strong> 수익률{' '}
                            {result.benchmarkReturnPct != null
                                ? <strong>{fmtPct(result.benchmarkReturnPct)}</strong>
                                : <span className="text-amber-600 dark:text-amber-400">조회 실패 (SPY 대비 열은 비어 있음)</span>}
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                "SPY 대비"가 + 면 그 그룹을 산 것이 지수 ETF를 산 것보다 나았다는 뜻입니다. 각 스냅샷일 직전 미국 거래일 종가 기준.
                            </div>
                        </div>
                    )}

                    {/* 표본 편향 경고 — 추천에서 빠진 종목은 집계에서 통째로 사라지므로 그 규모를 먼저 보여준다 */}
                    {result.baselineCount > 0 && (
                        <div className="mb-4 rounded-lg border border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                            기준일 <strong>{result.baselineCount}종목</strong> 중{' '}
                            <strong className="text-amber-700 dark:text-amber-400">
                                {result.unmatchedCount}종목 ({result.unmatchedPct?.toFixed(1)}%)
                            </strong>
                            은 최신일 스냅샷에 없어 집계에서 제외됐습니다.
                            {result.noBasePriceCount > 0 && ` (기준가 결측 ${result.noBasePriceCount}종목 별도 제외)`}
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                추천 로직은 저평가 스크리너이므로 주가가 오른 종목일수록 다음 추천에서 빠집니다.
                                이 비율이 높을수록 아래 평균수익률·승률은 실제보다 낮게 나올 수 있습니다.
                            </div>
                        </div>
                    )}
                    <SummaryTable title="투자판정별 성과" data={result.bySignal} />
                    <SummaryTable title="가치등급별 성과" data={result.byGrade} />
                    {/* 투자 순위별 — 기준일 순위 상위 20%가 하위 20%보다 실제로 나았는지 (순위의 실전 검증) */}
                    {result.byRank && result.byRank.length > 0
                        ? <SummaryTable title="투자 순위별 성과 (기준일 순위 상위 20% · 중간 · 하위 20%)" data={result.byRank} />
                        : result.byRank && (
                            <div className="mb-6 text-sm text-slate-400">
                                투자 순위별 성과: 기준일 스냅샷에 투자 순위가 없습니다. 2026-10-15 이후 날짜를 기준일로 선택하세요.
                            </div>
                        )}
                    {/* 추천 프로파일별 — 한 종목을 여러 프로파일이 추천했으면 각 프로파일에 모두 집계 */}
                    {result.profileTagged === true && (
                        <SummaryTable title="추천 프로파일별 성과 (중복 추천 종목은 각 프로파일에 포함)" data={result.byProfile} />
                    )}
                    {result.profileTagged === false && (
                        <div className="mb-6 text-sm text-slate-400">
                            추천 프로파일별 성과: 기준일 스냅샷에 프로파일 정보가 없습니다. 2026-10-13 이후 날짜를 기준일로 선택하세요.
                        </div>
                    )}
                </>
            )}

            {!result && !loading && (
                <div className="text-sm text-slate-400">기준일을 선택하고 조회하세요. 수익률은 며칠 이상 데이터가 쌓여야 유의미합니다.</div>
            )}

            <EvaluationPerformanceHelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
        </div>
    );
};

export default EvaluationPerformance;
