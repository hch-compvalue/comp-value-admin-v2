import { useState, useCallback, useEffect } from 'react';
import { send } from '@/util/ClientUtil';
import PageTitle from '@/component/common/display/PageTitle';
import EvaluationPerformanceHelpModal from '@/component/common/display/EvaluationPerformanceHelpModal';
import { BUY_TARGET_LABEL } from '@/util/BuyTargetUtil';

const fmtPct = (v) => {
    if (v == null) return '-';
    const n = Number(v);
    const cls = n > 0 ? 'text-rose-600 dark:text-rose-400' : n < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500';
    return <span className={`font-semibold ${cls}`}>{n > 0 ? '+' : ''}{n.toFixed(2)}%</span>;
};

// 지수 대비 초과수익(%p) — 판정이 "그냥 SPY를 산 것"보다 나았는지
const fmtExcess = (v) => {
    if (v == null) return <span className="text-slate-400">-</span>;
    const n = Number(v);
    const cls = n > 0 ? 'text-rose-600 dark:text-rose-400' : n < 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500';
    return <span className={`font-semibold ${cls}`}>{n > 0 ? '+' : ''}{n.toFixed(2)}%p</span>;
};

/* ---------- 기준일 ---------- */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const RANK_START_DATE = '2026-10-15';         // 투자 순위 저장 시작
const BUY_TARGET_START_DATE = '2026-10-22';   // 매수 대상 목록·프로파일 3개 적용
const BASE_DATE_STORAGE_KEY = 'evaluationPerformance.baseDate';

const isoDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
};
const DATE_PRESETS = [
    { label: '10-15 순위 시작', date: () => RANK_START_DATE },
    { label: `10-22 ${BUY_TARGET_LABEL}·프로파일 변경`, date: () => BUY_TARGET_START_DATE },
    { label: '4주 전', date: () => isoDaysAgo(4 * DAYS_PER_WEEK) },
    { label: '12주 전', date: () => isoDaysAgo(12 * DAYS_PER_WEEK) },
];

/** 마지막 기준일 (브라우저 저장 실패 시 순위 시작일) */
const loadBaseDate = () => {
    try { return localStorage.getItem(BASE_DATE_STORAGE_KEY) || RANK_START_DATE; } catch { return RANK_START_DATE; }
};
const saveBaseDate = (d) => {
    try { localStorage.setItem(BASE_DATE_STORAGE_KEY, d); } catch { /* 저장 불가 환경은 무시 */ }
};
const daysBetween = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / MS_PER_DAY) : 0);

/* ---------- 핵심 질문 판정 ---------- */
/** 이 기간·종목 수보다 작으면 결과를 "판단 보류"로 (백테스트 기준 보유기간은 6~12개월) */
const VERDICT_MIN_DAYS = 4 * DAYS_PER_WEEK;
const VERDICT_MIN_COUNT = 10;
/** 차이가 이 값(%p) 이내면 "비슷" */
const VERDICT_SAME_PCT = 0.5;

const VERDICT_STYLE = {
    better: { label: '나음 ▲', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
    worse: { label: '못함 ▼', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    same: { label: '비슷', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
    pending: { label: '판단 보류', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
};

const findGroup = (list, name) => (list || []).find((s) => s.group === name && s.count > 0);

/** 두 그룹 중앙값 차이 (같은 기간이라 SPY 대비 차이와 같음) */
const compare = (a, b) => (a && b && a.medianReturnPct != null && b.medianReturnPct != null
    ? { diff: a.medianReturnPct - b.medianReturnPct, minCount: Math.min(a.count, b.count) } : null);

const verdictOf = (cmp, elapsedDays) => {
    if (!cmp) return null;
    if (elapsedDays < VERDICT_MIN_DAYS || cmp.minCount < VERDICT_MIN_COUNT) return 'pending';
    if (Math.abs(cmp.diff) <= VERDICT_SAME_PCT) return 'same';
    return cmp.diff > 0 ? 'better' : 'worse';
};

/** 핵심 질문 4개 — 각각 결과 객체 { cmp, sub } (데이터 없으면 cmp null) */
const buildQuestions = (r) => {
    const target = findGroup(r.byBuyTarget, BUY_TARGET_LABEL);
    const all = findGroup(r.byBuyTarget, '후보 전체');
    const top = findGroup(r.byRank, '상위 20%');
    const bottom = findGroup(r.byRank, '하위 20%');
    const bUp = findGroup(r.byValueBand, '가치 B 이상');
    const cDown = findGroup(r.byValueBand, '가치 C 이하');
    const allVsSpy = all && all.excessMedianReturnPct != null ? { diff: all.excessMedianReturnPct, minCount: all.count } : null;
    return [
        { title: `${BUY_TARGET_LABEL}이 나았나?`, desc: `${BUY_TARGET_LABEL} − 후보 전체`, cmp: compare(target, all),
            sub: target && `SPY 이긴 비율 ${target.beatBenchmarkPct?.toFixed(0) ?? '-'}% · ${target.count}종목`,
            empty: `${BUY_TARGET_LABEL}은 ${BUY_TARGET_START_DATE} 이후 기준일부터 의미 있음 (서버 업데이트 전이면 준비 중)` },
        { title: '순위 상위 20% > 하위 20%?', desc: '상위 − 하위', cmp: compare(top, bottom),
            sub: top && bottom && `상위 ${top.count} · 하위 ${bottom.count}종목`, empty: `투자 순위는 ${RANK_START_DATE} 이후 기준일만` },
        { title: '가치 B 이상 > C 이하?', desc: 'B 이상 − C 이하', cmp: compare(bUp, cDown),
            sub: bUp && cDown && `B 이상 ${bUp.count} · C 이하 ${cDown.count}종목`, empty: '서버 업데이트 전이면 준비 중' },
        { title: '후보 전체 vs SPY', desc: '후보 전체 − SPY', cmp: allVsSpy,
            sub: all && `SPY 이긴 비율 ${all.beatBenchmarkPct?.toFixed(0) ?? '-'}% · ${all.count}종목`, empty: 'SPY 조회 실패 · 순위 없는 기준일 · 서버 업데이트 전 중 하나' },
    ];
};

const QuestionCard = ({ q, elapsedDays }) => {
    const v = verdictOf(q.cmp, elapsedDays);
    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{q.title}</div>
            <div className="text-xs text-slate-400 mb-2">{q.desc} (중앙값 기준)</div>
            {q.cmp ? (
                <>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{fmtExcess(q.cmp.diff)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${VERDICT_STYLE[v].cls}`}>{VERDICT_STYLE[v].label}</span>
                    </div>
                    {q.sub && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{q.sub}</div>}
                </>
            ) : <div className="text-xs text-slate-400 py-2">{q.empty}</div>}
        </div>
    );
};

/* ---------- 상세 표 ---------- */
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

/** SPY 대비(중앙) 막대 — 표 안 최대 절댓값 기준 길이, 플러스 빨강 / 마이너스 파랑 */
const ExcessBar = ({ value, scale }) => {
    if (value == null || !scale) return null;
    const width = `${Math.min(100, (Math.abs(value) / scale) * 100)}%`;
    return (
        <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className={`h-full ${value >= 0 ? 'bg-rose-400' : 'bg-blue-400'}`} style={{ width }} />
        </div>
    );
};

const pctText = (v) => (v != null ? `${v.toFixed(0)}%` : '-');

/** 열 정의 — basic: 기본 표시 (나머지는 "모든 열 보기") */
const COLUMNS = [
    { label: '종목수', basic: true, cell: (s) => (
        <>
            {s.count}
            {s.excludedCount > 0 && (
                <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400" title={`분할·병합 의심 또는 판별 불가로 ${s.excludedCount}종목 제외`}>(-{s.excludedCount})</span>
            )}
        </>
    ) },
    { label: '추적불가', cell: (s) => <UntrackedCell unmatched={s.unmatchedCount} noBasePrice={s.noBasePriceCount} /> },
    { label: 'SPY 대비(중앙)', basic: true, stat: true, cell: (s, scale) => (
        <div className="flex items-center justify-end gap-2">{fmtExcess(s.excessMedianReturnPct)}<ExcessBar value={s.excessMedianReturnPct} scale={scale} /></div>
    ) },
    { label: 'SPY 이긴 비율', basic: true, stat: true, cell: (s) => pctText(s.beatBenchmarkPct) },
    { label: '평균수익률', basic: true, stat: true, cell: (s) => fmtPct(s.avgReturnPct) },
    { label: '중앙값', stat: true, cell: (s) => fmtPct(s.medianReturnPct) },
    { label: '승률', stat: true, cell: (s) => pctText(s.winRatePct) },
    { label: 'SPY 대비(평균)', stat: true, cell: (s) => fmtExcess(s.excessAvgReturnPct) },
    { label: '최고', stat: true, cell: (s) => fmtPct(s.maxReturnPct) },
    { label: '최저', stat: true, cell: (s) => fmtPct(s.minReturnPct) },
];

const SummaryTable = ({ title, data, showAll }) => {
    const cols = COLUMNS.filter((c) => showAll || c.basic);
    const scale = Math.max(0, ...(data || []).map((s) => Math.abs(s.excessMedianReturnPct ?? 0)));
    return (
        <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                            <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-left whitespace-nowrap">그룹</th>
                            {cols.map((c) => (
                                <th key={c.label} className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 text-right whitespace-nowrap">{c.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {(!data || data.length === 0) && (
                            <tr><td colSpan={cols.length + 1} className="px-4 py-6 text-center text-slate-400">데이터 없음</td></tr>
                        )}
                        {data && data.map((s) => (
                            <tr key={s.group} className="border-t border-slate-100 dark:border-slate-800">
                                <td className="px-4 py-2.5 text-left font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{s.group}</td>
                                {/* 집계 대상이 0종목이면 통계값이 없으므로 수치 대신 대시 표기 */}
                                {cols.map((c) => (
                                    <td key={c.label} className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                        {c.stat && s.count === 0 ? '-' : c.cell(s, scale)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/** 그룹 목록이 없을 때(옛 스냅샷·서버 업데이트 전) 표 대신 한 줄 안내 */
const OptionalTable = ({ title, data, showAll, emptyNote }) => (
    data && data.length > 0
        ? <SummaryTable title={title} data={data} showAll={showAll} />
        : <div className="mb-6 text-sm text-slate-400">{title}: {emptyNote}</div>
);

/**
 * 성과 추적 (2-4)
 * 기준일의 매수 대상·투자 순위·가치등급·추천 프로파일·투자판정별 이후 실제 수익률 — 맨 위 핵심 질문 4개로 결론부터
 */
const EvaluationPerformance = () => {
    const [fromDate, setFromDate] = useState(loadBaseDate);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    const fetchData = useCallback(async (date) => {
        setLoading(true);
        setError('');
        saveBaseDate(date);
        const { data, error } = await send(`/dart/main/evaluation/performance?from=${date}`, null, 'GET');
        if (error) { setError(error); setResult(null); }
        else setResult(data?.response || null);
        setLoading(false);
    }, []);

    // 처음 열 때 마지막 기준일로 바로 조회
    useEffect(() => { fetchData(loadBaseDate()); }, [fetchData]);

    const pickPreset = (date) => {
        setFromDate(date);
        fetchData(date);
    };

    const elapsedDays = result ? daysBetween(result.baseDate, result.latestDate) : 0;

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
                    onClick={() => fetchData(fromDate)}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={loading}
                >
                    {loading ? '조회 중…' : '조회'}
                </button>
                <div className="flex flex-wrap gap-1.5">
                    {DATE_PRESETS.map((p) => (
                        <button
                            key={p.label}
                            type="button"
                            onClick={() => pickPreset(p.date())}
                            disabled={loading}
                            aria-pressed={fromDate === p.date()}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
                                fromDate === p.date()
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-4 py-3 text-sm">{error}</div>
            )}

            {result && (
                <>
                    <div className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                        기준일 {result.baseDate || '-'} → 최신일 {result.latestDate || '-'} ({elapsedDays}일 경과)
                        {!result.note && <> · 같은 기간 {result.benchmarkSymbol || 'SPY'} {result.benchmarkReturnPct != null
                            ? fmtPct(result.benchmarkReturnPct)
                            : <span className="text-amber-600 dark:text-amber-400">조회 실패</span>}</>}
                        {result.note && <span className="ml-2 text-amber-600 dark:text-amber-400">· {result.note}</span>}
                    </div>

                    {/* 핵심 질문 — 결론부터 (표를 비교하지 않아도 되도록) */}
                    {!result.note && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
                                {buildQuestions(result).map((q) => <QuestionCard key={q.title} q={q} elapsedDays={elapsedDays} />)}
                            </div>
                            <div className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                                {elapsedDays < VERDICT_MIN_DAYS
                                    ? <span className="text-amber-600 dark:text-amber-400">경과 {elapsedDays}일 — {VERDICT_MIN_DAYS / DAYS_PER_WEEK}주 미만은 "판단 보류"(참고만). </span>
                                    : null}
                                중앙값 차이 ±{VERDICT_SAME_PCT}%p 이내는 "비슷", 종목 {VERDICT_MIN_COUNT}개 미만도 "판단 보류". 백테스트 기준 보유기간은 6~12개월이라 몇 달 쌓여야 결론을 낼 수 있습니다.
                            </div>
                        </>
                    )}

                    {/* 표본 편향 경고 — 추천에서 빠진 종목은 집계에서 통째로 사라지므로 그 규모를 먼저 보여준다 */}
                    {result.baselineCount > 0 && (
                        <div className="mb-4 rounded-lg border border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                            기준일 {result.baselineCount}종목 중{' '}
                            <strong className="text-amber-700 dark:text-amber-400">{result.unmatchedCount}종목 ({result.unmatchedPct?.toFixed(1)}%)</strong>
                            은 최신일 스냅샷에 없어 집계에서 빠졌습니다{result.noBasePriceCount > 0 && ` (기준가 결측 ${result.noBasePriceCount}종목 별도)`}.
                            오른 종목일수록 저평가 추천에서 빠지므로, 이 비율이 높으면 아래 수익률은 실제보다 낮게 나올 수 있습니다.
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">상세 표</h2>
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="rounded border-slate-300" />
                            모든 열 보기
                        </label>
                    </div>

                    <OptionalTable title={`${BUY_TARGET_LABEL}별 성과 (금융 제외 기준)`} data={result.byBuyTarget} showAll={showAll}
                        emptyNote={`기준일 스냅샷에 투자 순위가 없거나 서버가 아직 업데이트되지 않았습니다. ${RANK_START_DATE} 이후 날짜를 선택하세요.`} />
                    {/* 투자 순위별 — 기준일 순위 상위 20%가 하위 20%보다 실제로 나았는지 (순위의 실전 검증) */}
                    <OptionalTable title="투자 순위별 성과 (기준일 순위 상위 20% · 중간 · 하위 20%)" data={result.byRank} showAll={showAll}
                        emptyNote={`기준일 스냅샷에 투자 순위가 없습니다. ${RANK_START_DATE} 이후 날짜를 기준일로 선택하세요.`} />
                    <SummaryTable title="가치등급별 성과" data={result.byGrade} showAll={showAll} />
                    {/* 추천 프로파일별 — 한 종목을 여러 프로파일이 추천했으면 각 프로파일에 모두 집계, "단독" = 그 프로파일에만 추천된 종목 */}
                    {result.profileTagged === true && (
                        <SummaryTable title="추천 프로파일별 성과 (중복 추천 종목은 각 프로파일에 포함 · 단독 = 그 프로파일에만 추천)" data={result.byProfile} showAll={showAll} />
                    )}
                    {result.profileTagged === false && (
                        <div className="mb-6 text-sm text-slate-400">
                            추천 프로파일별 성과: 기준일 스냅샷에 프로파일 정보가 없습니다. 2026-10-13 이후 날짜를 기준일로 선택하세요.
                        </div>
                    )}
                    <SummaryTable title="투자판정별 성과 (참고 — 매수 후보/관심목록 차이는 타이밍뿐이고 타이밍은 근거 없음)" data={result.bySignal} showAll={showAll} />
                </>
            )}

            {!result && !loading && !error && (
                <div className="text-sm text-slate-400">기준일을 선택하고 조회하세요. 수익률은 몇 주 이상 데이터가 쌓여야 유의미합니다.</div>
            )}

            <EvaluationPerformanceHelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
        </div>
    );
};

export default EvaluationPerformance;
