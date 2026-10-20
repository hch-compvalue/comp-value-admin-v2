import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { send, API_ENDPOINTS } from '@/util/ClientUtil';
import { STOCK_ANALYSIS_PATH, SUB_TAB } from '@/config/menuPaths';
import PageTitle from '@/component/common/display/PageTitle';
import DailyPicksHelpModal from '@/component/common/display/DailyPicksHelpModal';
import CompanyValueResultModal from '@/pages/trade/popup/CompanyValueResultModal';
import { GRADE_STYLE } from '@/util/GradeStyleUtil';
import { SIGNAL_STYLE, SignalDot } from '@/util/SignalStyleUtil';
import { AlertTriangle } from 'lucide-react';

const SIGNAL_ORDER = ['매수 후보', '관심목록', '관망'];
const ALL_SIGNALS = '전체';

const TIMING_STYLE = {
    '양호': 'text-blue-600 dark:text-blue-400 font-semibold',
    '대기': 'text-amber-600 dark:text-amber-400 font-medium',
    '하락': 'text-orange-600 dark:text-orange-400 font-semibold',
    '관망': 'text-slate-500 dark:text-slate-400',
};

// 추천 프로파일 태그 (백엔드 EvaluationHistoryEntity.PROFILE_DELIMITER와 동일)
const PROFILE_DELIMITER = '|';
// 일괄 평가로 넘길 수 있는 최대 종목 수 (일괄 평가는 50건씩 15초 간격이라 200건 ≈ 1분 + FMP 호출량 고려)
const MAX_HANDOFF_SYMBOLS = 200;
const ALL_PROFILES = '전체';
const parseProfiles = (value) => (value ? value.split(PROFILE_DELIMITER).filter(Boolean) : []);

// 적정가 경고 기준 — 백엔드 EvaluationConst 와 같은 값 (순위 점수에는 영향 없음, 표시만)
// 고평가 구간 = Step3 가격괴리 0점 구간: 공통 STEP3_GAP_SLIGHT_OVERVALUED_PCT, 금융 FIN_STEP3_GAP_SLIGHT_OVERVALUED_PCT
// (금융 기준은 PBR 경로 종목용 — 화면엔 경로 정보가 없어 섹터로 판단하므로 해외 공시 금융주는 조금 엄격하게 경고될 수 있음)
const OVERVALUED_GAP_PCT = -36;
const FIN_OVERVALUED_GAP_PCT = -11;
const FINANCIAL_SECTOR = 'Financial Services';
const EXTREME_GAP_PCT = 200;   // QUALITY_GATE_UNREALISTIC_GAP_PCT — 계산 신뢰도 낮은 괴리

/** 적정가 대비 괴리율(%) — 적정가·현재가가 없으면 null */
const gapPct = (row) => (row.fairValue == null || !row.currentPrice ? null : (row.fairValue / row.currentPrice - 1) * 100);

/** 투자 판단 시 놓치면 안 되는 적정가 경고 (순위 점수와 별개) */
const valuationWarnings = (row) => {
    const gap = gapPct(row);
    if (gap == null) return [];
    if (Math.abs(gap) >= EXTREME_GAP_PCT) {
        return [{ label: '적정가 극단값', title: `적정가 대비 ${gap > 0 ? '+' : ''}${gap.toFixed(0)}% — 적정가 계산을 믿기 어려운 수준` }];
    }
    const limit = row.sector === FINANCIAL_SECTOR ? FIN_OVERVALUED_GAP_PCT : OVERVALUED_GAP_PCT;
    return gap < limit
        ? [{ label: 'V9 고평가 구간', title: `현재가가 적정가보다 ${Math.abs(gap).toFixed(0)}% 높음 (가치 평가상 고평가 구간 ${limit}% 미만)` }]
        : [];
};

// 백분위(0~100, 높을수록 좋음) → "상위 N%" 표기 (최소 1%)
const topPct = (pct) => Math.max(1, Math.round(100 - pct));

/** 투자 순위 근거: 수익성·가치 상위 비율 + 최근 1주 수익률 (순위 점수가 없으면 null) */
const RankReason = ({ row }) => {
    const warnings = valuationWarnings(row).map((w) => (
        <span key={w.label} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold dark:bg-orange-900/50 dark:text-orange-200" title={w.title}>
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />{w.label}
        </span>
    ));
    if (row.rankScore == null) {
        return warnings.length > 0 ? <div className="flex flex-wrap gap-1 text-xs">{warnings}</div> : <span className="text-slate-400">-</span>;
    }
    const ret = row.return1wPct;
    return (
        <div className="flex flex-wrap gap-1 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" title={`ROE ${row.roe != null ? (row.roe * 100).toFixed(1) + '%' : '-'}`}>
                수익성 상위 {topPct(row.roePct)}%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" title={`가치점수 ${Number(row.valueScore).toFixed(0)}`}>
                가치 상위 {topPct(row.valuePct)}%
            </span>
            <span className={`px-1.5 py-0.5 rounded ${ret < 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
                  title="최근 5거래일 수익률 — 하락이 클수록 단기 눌림 점수가 높음">
                1주 {ret > 0 ? '+' : ''}{Number(ret).toFixed(1)}%
            </span>
            {warnings}
        </div>
    );
};

/** 투자 순위 점수 막대 (0~100) */
const RankBar = ({ score }) => (
    score == null ? <span className="text-slate-400">-</span> : (
        <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-blue-500 dark:bg-blue-400" style={{ width: `${score}%` }} />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{Number(score).toFixed(1)}</span>
        </div>
    )
);

const fmtPrice = (v) => (v == null ? '-' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/**
 * 오늘의 매수후보 (2-2)
 * 자동 전수평가 결과를 투자판정(매수후보>관심목록>관망) 순으로 표시
 */
const DailyPicks = () => {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [baseDate, setBaseDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [signalFilter, setSignalFilter] = useState(ALL_SIGNALS);  // 기본: 전체 후보를 투자 순위순으로
    const [profileFilter, setProfileFilter] = useState(ALL_PROFILES);
    const [sortKey, setSortKey] = useState('rankScore');
    const [sortDir, setSortDir] = useState('desc');
    const [showValueModal, setShowValueModal] = useState(false);
    const [compValueData, setCompValueData] = useState({});
    const [valueLoadingSymbol, setValueLoadingSymbol] = useState(null);
    const valueInFlight = useRef(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        const { data, error } = await send('/dart/main/evaluation/daily', null, 'GET');
        if (error) {
            setError(error);
            setRows([]);
        } else {
            const list = data?.response || [];
            setRows(list);
            setBaseDate(list.length > 0 ? (list[0].snapshotDate || '') : '');
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // 행 더블클릭 → 기업가치 실시간 재계산 후 결과 모달 표시
    const handleRowDoubleClick = useCallback(async (symbol) => {
        if (!symbol || valueInFlight.current) return;
        valueInFlight.current = true;
        setValueLoadingSymbol(symbol);
        setError('');
        try {
            const { data, error } = await send(API_ENDPOINTS.ABROAD_COMP_VALUE(symbol), {}, 'GET');
            if (!error && data?.response && Object.keys(data.response).length > 0) {
                setCompValueData(data.response);
                setShowValueModal(true);
            } else {
                setError(`${symbol}: 기업가치 계산 결과가 없거나 서버 응답을 받지 못했습니다.`);
            }
        } finally {
            setValueLoadingSymbol(null);
            valueInFlight.current = false;
        }
    }, []);

    // 프로파일별 종목 수 (태그 등장 순서 = 프로파일 정렬순). 태그 없는 옛 스냅샷이면 빈 배열
    const profileCounts = useMemo(() => {
        const map = new Map();
        rows.forEach((r) => parseProfiles(r.sourceProfiles).forEach((p) => map.set(p, (map.get(p) || 0) + 1)));
        return Array.from(map.entries());
    }, [rows]);

    // 선택한 프로파일이 다른 날짜 스냅샷에 없으면 전체로 되돌림
    useEffect(() => {
        if (profileFilter !== ALL_PROFILES && !profileCounts.some(([p]) => p === profileFilter)) {
            setProfileFilter(ALL_PROFILES);
        }
    }, [profileCounts, profileFilter]);

    // 프로파일 필터 적용 → 투자판정 타일과 표가 같은 모집단을 보도록
    const profileRows = useMemo(() => (
        profileFilter === ALL_PROFILES ? rows : rows.filter((r) => parseProfiles(r.sourceProfiles).includes(profileFilter))
    ), [rows, profileFilter]);

    // 투자 순위 (선택한 프로파일 모집단 안에서 순위 점수 내림차순, 점수 없는 종목은 순위 없음)
    const rankBySymbol = useMemo(() => {
        const ranked = profileRows.filter((r) => r.rankScore != null).sort((a, b) => b.rankScore - a.rankScore);
        return new Map(ranked.map((r, i) => [r.symbol, i + 1]));
    }, [profileRows]);
    const hasRank = rankBySymbol.size > 0;

    // 순위 점수가 없는 옛 스냅샷이면 가치점수 정렬로 대체
    const effectiveSortKey = sortKey === 'rankScore' && !hasRank ? 'valueScore' : sortKey;

    // 투자판정별 집계
    const counts = useMemo(() => {
        const c = { '매수 후보': 0, '관심목록': 0, '관망': 0 };
        profileRows.forEach((r) => { if (c[r.investmentSignal] != null) c[r.investmentSignal]++; });
        return c;
    }, [profileRows]);

    const filtered = useMemo(() => {
        let list = signalFilter === ALL_SIGNALS ? profileRows : profileRows.filter((r) => r.investmentSignal === signalFilter);
        list = [...list].sort((a, b) => {
            const av = a[effectiveSortKey], bv = b[effectiveSortKey];
            if (av == null) return 1;
            if (bv == null) return -1;
            const an = typeof av === 'string' ? parseFloat(av) : av;
            const bn = typeof bv === 'string' ? parseFloat(bv) : bv;
            if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
        return list;
    }, [profileRows, signalFilter, effectiveSortKey, sortDir]);

    // 현재 표에 보이는 종목을 종목 분석 > 일괄 평가로 넘겨 실시간 재평가
    const handleEvaluateVisible = () => {
        const query = new URLSearchParams({ symbol: filtered.map((r) => r.symbol).join(',') });
        navigate(`${STOCK_ANALYSIS_PATH}?${query}`, { state: { subTab: SUB_TAB.EVALUATE } });
    };
    const canHandoff = filtered.length > 0 && filtered.length <= MAX_HANDOFF_SYMBOLS;

    const handleSort = (key) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('desc'); }
    };

    // 적정가·매수적정가는 상세(더블클릭)에서 확인 — V9 적정가는 보수적 추정이라 표에서 현재가와 바로 비교하면 오해 소지
    const COLUMNS = [
        { key: 'rankScore', label: '순위', num: true },
        { key: 'symbol', label: '심볼' },
        { key: 'companyName', label: '기업명' },
        { key: 'rankScore', label: '투자 순위 점수', num: true, id: 'rankScoreBar' },
        { key: 'roePct', label: '근거' },
        { key: 'investmentSignal', label: '투자판정' },
        { key: 'valueScore', label: '가치등급', num: true },
        { key: 'timingSignal', label: '타이밍(참고)' },
        { key: 'currentPrice', label: '현재가', num: true },
        { key: 'sector', label: '섹터' },
        { key: 'sourceProfiles', label: '추천 프로파일' },
    ];

    return (
        <div className="p-4 md:p-6">
            <div className="flex items-start justify-between gap-3">
                <PageTitle />
                <button
                    type="button"
                    onClick={() => setIsHelpModalOpen(true)}
                    className="mt-1 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="오늘의 매수후보 페이지 설명"
                    aria-label="오늘의 매수후보 페이지 설명"
                >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold">?</span>
                    페이지 설명
                </button>
            </div>

            {/* 요약 타일 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <button
                    onClick={() => setSignalFilter(ALL_SIGNALS)}
                    className={`rounded-lg border px-4 py-3 text-left transition-colors bg-white dark:bg-slate-800 ${
                        signalFilter === ALL_SIGNALS ? 'border-blue-500 ring-2 ring-blue-400/40' : 'border-slate-200 dark:border-slate-700'
                    }`}
                >
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">전체 후보</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{profileRows.length}</div>
                </button>
                {SIGNAL_ORDER.map((sig) => (
                    <button
                        key={sig}
                        onClick={() => setSignalFilter(sig)}
                        className={`rounded-lg border px-4 py-3 text-left transition-colors bg-white dark:bg-slate-800 ${
                            signalFilter === sig
                                ? 'border-blue-500 ring-2 ring-blue-400/40'
                                : 'border-slate-200 dark:border-slate-700'
                        }`}
                    >
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"><SignalDot signal={sig} />{sig}</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{counts[sig]}</div>
                    </button>
                ))}
            </div>

            {/* 투자 순위 안내 — 순위 점수 없는 옛 스냅샷이면 대체 정렬 안내 */}
            {rows.length > 0 && (
                <div className="mb-4 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                    {hasRank
                        ? <>투자 순위 = 후보 안에서 <strong>수익성(ROE) · 가치점수 · 최근 1주 눌림</strong>의 상위 비율을 같은 비중으로 합친 점수입니다. 2~4주 보유 기준 백테스트에서 순위가 높을수록 성과가 나았던 요소만 썼습니다. 타이밍은 효과가 확인되지 않아 참고용입니다.</>
                        : <>이 스냅샷에는 투자 순위가 없어 가치점수 순으로 보여줍니다. 투자 순위는 2026-10-15 평가분부터 표시됩니다.</>}
                </div>
            )}

            {/* 추천 프로파일 필터 (태그가 있는 스냅샷만) */}
            {profileCounts.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">추천 프로파일</span>
                    {[[ALL_PROFILES, rows.length], ...profileCounts].map(([name, count]) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => setProfileFilter(name)}
                            aria-pressed={profileFilter === name}
                            className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                                profileFilter === name
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                        >
                            {name} <span className="ml-0.5 text-slate-400">{count}</span>
                        </button>
                    ))}
                </div>
            ) : rows.length > 0 && (
                <div className="mb-4 text-xs text-slate-400">이 평가 스냅샷에는 추천 프로파일 정보가 없습니다 (2026-10-13 이후 평가분부터 표시)</div>
            )}

            <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    {baseDate && `평가 기준일: ${baseDate}`} · 매일 오전 10시 자동 전수평가 결과 · 행 더블클릭 시 기업가치 계산
                    {valueLoadingSymbol && <span className="ml-2 text-blue-600 dark:text-blue-400">({valueLoadingSymbol} 계산 중…)</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleEvaluateVisible}
                        disabled={!canHandoff}
                        title={filtered.length > MAX_HANDOFF_SYMBOLS
                            ? `한 번에 ${MAX_HANDOFF_SYMBOLS}종목까지 넘길 수 있습니다. 투자판정·프로파일로 범위를 좁혀주세요.`
                            : '표에 보이는 종목을 종목 분석 > 일괄 평가에서 실시간으로 다시 평가합니다'}
                        className="px-3 py-1.5 text-sm rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-blue-300 dark:border-blue-500 dark:hover:bg-slate-800"
                    >
                        표시 종목 일괄 평가 ({filtered.length})
                    </button>
                    <button
                        onClick={fetchData}
                        className="px-3 py-1.5 text-sm rounded-lg bg-brand text-white hover:bg-brand-hover disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? '조회 중…' : '새로고침'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                            {COLUMNS.map((col) => (
                                <th
                                    key={col.id || col.label}
                                    onClick={() => handleSort(col.key)}
                                    className={`px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap ${col.num ? 'text-right' : 'text-left'}`}
                                >
                                    {col.label}
                                    {effectiveSortKey === col.key && col.id !== 'rankScoreBar' && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && !loading && (
                            <tr><td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-slate-400">
                                데이터가 없습니다. (매일 오전 10시 스케줄 실행 후 표시됩니다)
                            </td></tr>
                        )}
                        {filtered.map((r) => (
                            <tr
                                key={r.symbol}
                                onDoubleClick={() => handleRowDoubleClick(r.symbol)}
                                title="더블클릭: 기업가치 계산 결과 보기"
                                className={`border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer select-none ${
                                    valueLoadingSymbol === r.symbol ? 'opacity-60' : ''
                                }`}
                            >
                                <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 tabular-nums">{rankBySymbol.get(r.symbol) ?? '-'}</td>
                                <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">{r.symbol}</td>
                                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 max-w-[200px] truncate">{r.companyName || '-'}</td>
                                <td className="px-4 py-2.5"><RankBar score={r.rankScore} /></td>
                                <td className="px-4 py-2.5 min-w-[220px]"><RankReason row={r} /></td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${SIGNAL_STYLE[r.investmentSignal] || ''}`}>
                                        <SignalDot signal={r.investmentSignal} />{r.investmentSignal || '-'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${GRADE_STYLE[r.valueGrade] || ''}`}>{r.valueGrade || '-'}</span>
                                    <span className="ml-1 text-xs text-slate-400">{r.valueScore != null ? Number(r.valueScore).toFixed(0) : ''}</span>
                                </td>
                                <td className={`px-4 py-2.5 text-center ${TIMING_STYLE[r.timingSignal] || ''}`}>{r.timingSignal || '-'}</td>
                                <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtPrice(r.currentPrice)}</td>
                                <td className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.sector || '-'}</td>
                                <td className="px-4 py-2.5 text-left whitespace-nowrap">
                                    {parseProfiles(r.sourceProfiles).length === 0 ? <span className="text-slate-400">-</span> : (
                                        <div className="flex gap-1">
                                            {parseProfiles(r.sourceProfiles).map((p) => (
                                                <span key={p} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs">{p}</span>
                                            ))}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <DailyPicksHelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
            <CompanyValueResultModal
                isOpen={showValueModal}
                onClose={() => setShowValueModal(false)}
                data={compValueData}
            />
        </div>
    );
};

export default DailyPicks;
