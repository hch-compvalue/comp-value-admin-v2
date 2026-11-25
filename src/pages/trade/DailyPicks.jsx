import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { send } from '@/util/ClientUtil';
import { fetchCompValue } from '@/util/StockApi';
import { useMarket } from '@/context/MarketContext';
import { MARKET, fmtPrice } from '@/util/MarketUtil';
import { STOCK_ANALYSIS_PATH, SUB_TAB } from '@/config/menuPaths';
import PageTitle from '@/component/common/display/PageTitle';
import DailyPicksHelpModal from '@/component/common/display/DailyPicksHelpModal';
import CompanyValueResultModal from '@/pages/trade/popup/CompanyValueResultModal';
import { GRADE_STYLE } from '@/util/GradeStyleUtil';
import { AlertTriangle } from 'lucide-react';
import { PENDING_LABEL, PENDING_BADGE, PICK_TOP_N, PICK_RULES, KR_PICK_CAUTION, US_PICK_CAUTION, KR_PICK_EVIDENCE, US_PICK_EVIDENCE } from '@/util/ValidationGuide';
import { FINANCIAL_SECTOR } from '@/util/BuyTargetUtil';

// 순위 = 가치점수 순 — 1개월 순위 시합(2026-11-25, 합성 점수·AI 포함)에서 가치점수를 넘는 방식 없음 (util/ValidationGuide)
// 투자 순위 점수·투자판정·타이밍·매수 대상은 근거가 없어 화면에서 뺌 (데이터는 성과 추적에서 계속 기록)
const DEFAULT_SORT_KEY = 'valueScore';

// 일괄 평가로 넘길 수 있는 최대 종목 수 (일괄 평가는 50건씩 15초 간격이라 200건 ≈ 1분 + FMP 호출량 고려)
const MAX_HANDOFF_SYMBOLS = 200;

// 적정가 경고 기준 — 백엔드 EvaluationConst 와 같은 값 (순위에는 영향 없음, 표시만)
// 고평가 구간 = Step3 가격괴리 0점 구간: 공통 STEP3_GAP_SLIGHT_OVERVALUED_PCT, 금융 FIN_STEP3_GAP_SLIGHT_OVERVALUED_PCT
// (금융 기준은 PBR 경로 종목용 — 화면엔 경로 정보가 없어 섹터로 판단하므로 해외 공시 금융주는 조금 엄격하게 경고될 수 있음)
const OVERVALUED_GAP_PCT = -36;
const FIN_OVERVALUED_GAP_PCT = -11;
const EXTREME_GAP_PCT = 200;   // QUALITY_GATE_UNREALISTIC_GAP_PCT — 계산 신뢰도 낮은 괴리

/** 적정가 대비 괴리율(%) — 적정가·현재가가 없으면 null */
const gapPct = (row) => (row.fairValue == null || !row.currentPrice ? null : (row.fairValue / row.currentPrice - 1) * 100);

/** 투자 판단 시 놓치면 안 되는 적정가 경고 (순위와 별개) */
const valuationWarning = (row) => {
    const gap = gapPct(row);
    if (gap == null) return null;
    if (Math.abs(gap) >= EXTREME_GAP_PCT) {
        return { label: '적정가 극단값', title: `적정가 대비 ${gap > 0 ? '+' : ''}${gap.toFixed(0)}% — 적정가 계산을 믿기 어려운 수준` };
    }
    const limit = row.sector === FINANCIAL_SECTOR ? FIN_OVERVALUED_GAP_PCT : OVERVALUED_GAP_PCT;
    return gap < limit ? { label: '고평가 구간', title: `현재가가 적정가보다 ${Math.abs(gap).toFixed(0)}% 높음 (가치 평가상 고평가 구간 ${limit}% 미만)` } : null;
};

// 가로 스크롤해도 어느 종목인지 보이게 심볼 열 고정
const STICKY_CELL = 'sticky left-0 z-10';

/**
 * 오늘의 매수후보 (종목 발굴)
 * 자동 전수평가 후보를 가치점수 순위로 보여주고, 매달 상위 30에서 나눠 담는 규칙만 안내
 */
const DailyPicks = () => {
    const navigate = useNavigate();
    const { market } = useMarket();
    const isKr = market === MARKET.KR;
    const [rows, setRows] = useState([]);
    const [baseDate, setBaseDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);
    const [sortDir, setSortDir] = useState('desc');

    // 시장 전환 시 기본 정렬로 되돌림
    useEffect(() => {
        setSortKey(DEFAULT_SORT_KEY);
        setSortDir('desc');
    }, [isKr]);
    const [showValueModal, setShowValueModal] = useState(false);
    const [compValueData, setCompValueData] = useState({});
    const [valueLoadingSymbol, setValueLoadingSymbol] = useState(null);
    const valueInFlight = useRef(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        const { data, error } = await send(`/dart/main/evaluation/daily?market=${market}`, null, 'GET');
        if (error) {
            setError(error);
            setRows([]);
        } else {
            const list = data?.response || [];
            setRows(list);
            setBaseDate(list.length > 0 ? (list[0].snapshotDate || '') : '');
        }
        setLoading(false);
    }, [market]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // 행 클릭(모바일은 탭) → 기업가치 실시간 재계산 후 결과 모달 표시
    const handleRowClick = useCallback(async (symbol) => {
        if (!symbol || valueInFlight.current) return;
        valueInFlight.current = true;
        setValueLoadingSymbol(symbol);
        setError('');
        try {
            const { data, error } = await fetchCompValue(symbol, market);
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
    }, [market]);

    // 순위 = 후보 전체 안 가치점수 내림차순 (점수 없는 종목은 순위 없음)
    const rankBySymbol = useMemo(() => {
        const ranked = rows.filter((r) => r.valueScore != null).sort((a, b) => b.valueScore - a.valueScore);
        return new Map(ranked.map((r, i) => [r.symbol, i + 1]));
    }, [rows]);

    const sorted = useMemo(() => [...rows].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        const an = typeof av === 'string' ? parseFloat(av) : av;
        const bn = typeof bv === 'string' ? parseFloat(bv) : bv;
        if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    }), [rows, sortKey, sortDir]);

    // 상위 30 종목을 종목 분석 > 일괄 평가로 넘겨 실시간 재평가 (미국만)
    const topSymbols = useMemo(() => rows.filter((r) => (rankBySymbol.get(r.symbol) ?? Infinity) <= PICK_TOP_N).map((r) => r.symbol), [rows, rankBySymbol]);
    const handleEvaluateTop = () => {
        const query = new URLSearchParams({ symbol: topSymbols.join(',') });
        navigate(`${STOCK_ANALYSIS_PATH}?${query}`, { state: { subTab: SUB_TAB.EVALUATE } });
    };
    const canHandoff = !isKr && topSymbols.length > 0 && topSymbols.length <= MAX_HANDOFF_SYMBOLS;

    const handleSort = (key) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('desc'); }
    };

    // 적정가·매수적정가는 상세(행 클릭)에서 확인 — V9 적정가는 보수적 추정이라 표에서 현재가와 바로 비교하면 오해 소지
    const COLUMNS = [
        { key: 'valueScore', label: '순위', num: true, id: 'rank', title: '가치점수 순위' },
        { key: 'symbol', label: isKr ? '종목코드' : '심볼' },
        { key: 'companyName', label: '기업명' },
        { key: 'valueScore', label: '가치등급', num: true },
        { key: 'currentPrice', label: '현재가', num: true },
        { key: 'sector', label: '섹터' },
    ];

    return (
        <div>
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

            {/* 사용 규칙 — 근거 수치는 페이지 설명(도움말)에 */}
            <div className="mb-4 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                <ol className="list-decimal list-inside space-y-1">
                    {PICK_RULES.map((rule) => <li key={rule}>{rule}</li>)}
                    <li>{isKr ? KR_PICK_CAUTION : US_PICK_CAUTION}</li>
                </ol>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className={`${PENDING_BADGE} mr-1.5`}>{PENDING_LABEL}</span>
                    {isKr ? KR_PICK_EVIDENCE : US_PICK_EVIDENCE} 자세한 근거는 페이지 설명에 있습니다.
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    후보 {rows.length}종목{baseDate && ` · 평가 기준일 ${baseDate}`} · {isKr ? '평일 17:30 갱신 (가격은 전 거래일 종가)' : '매일 오전 10시 갱신'} · 행을 누르면 기업가치 계산
                    {valueLoadingSymbol && <span className="ml-2 text-blue-600 dark:text-blue-400">({valueLoadingSymbol} 계산 중…)</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!isKr && (
                        <button
                            type="button"
                            onClick={handleEvaluateTop}
                            disabled={!canHandoff}
                            title={`순위 상위 ${PICK_TOP_N}종목을 종목 분석 > 일괄 평가에서 실시간으로 다시 평가합니다`}
                            className="px-3 py-1.5 text-sm rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-blue-300 dark:border-blue-500 dark:hover:bg-slate-800"
                        >
                            상위 {PICK_TOP_N} 일괄 평가
                        </button>
                    )}
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
                                    title={col.title}
                                    className={`px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap ${col.num ? 'text-right' : 'text-left'} ${col.key === 'symbol' ? `${STICKY_CELL} bg-slate-50 dark:bg-slate-800` : ''}`}
                                >
                                    {col.label}
                                    {sortKey === col.key && !col.id && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 && !loading && (
                            <tr><td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-slate-400">
                                데이터가 없습니다. ({isKr ? '평일 17:30' : '매일 오전 10시'} 스케줄 실행 후 표시됩니다)
                            </td></tr>
                        )}
                        {sorted.map((r) => {
                            const rank = rankBySymbol.get(r.symbol);
                            const inTop = rank != null && rank <= PICK_TOP_N;
                            const warning = valuationWarning(r);
                            return (
                                <tr
                                    key={r.symbol}
                                    onClick={() => handleRowClick(r.symbol)}
                                    title="클릭: 기업가치 계산 결과 보기"
                                    className={`group border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 select-none cursor-pointer ${
                                        valueLoadingSymbol === r.symbol ? 'opacity-60' : ''
                                    }`}
                                >
                                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                                        {inTop
                                            ? <span className="inline-flex min-w-[2rem] justify-center px-1.5 py-0.5 rounded bg-blue-600 text-white text-xs font-bold" title={`상위 ${PICK_TOP_N}`}>{rank}</span>
                                            : <span className="text-slate-400">{rank ?? '-'}</span>}
                                    </td>
                                    <td className={`px-4 py-2.5 font-semibold text-slate-900 dark:text-white ${STICKY_CELL} bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800`}>{r.symbol}</td>
                                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                                        <div className="flex items-center gap-1.5">
                                            <span className="max-w-[200px] truncate">{r.companyName || '-'}</span>
                                            {warning && (
                                                <span className="inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-xs font-semibold dark:bg-orange-900/50 dark:text-orange-200" title={warning.title}>
                                                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />{warning.label}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${GRADE_STYLE[r.valueGrade] || ''}`}>{r.valueGrade || '-'}</span>
                                        <span className="ml-1 text-xs text-slate-400">{r.valueScore != null ? Number(r.valueScore).toFixed(0) : ''}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtPrice(r.currentPrice, market)}</td>
                                    <td className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.sector || '-'}</td>
                                </tr>
                            );
                        })}
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
