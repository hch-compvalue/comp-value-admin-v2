import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { send, API_ENDPOINTS } from '@/util/ClientUtil';
import PageTitle from '@/component/common/display/PageTitle';
import DailyPicksHelpModal from '@/component/common/display/DailyPicksHelpModal';
import CompanyValueResultModal from '@/pages/trade/popup/CompanyValueResultModal';

// 색각이상 친화 팔레트 (파랑/노랑/회색) — 초록 대신 파랑
const SIGNAL_STYLE = {
    '매수 후보': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    '관심목록': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    '관망': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};
const SIGNAL_ICON = { '매수 후보': '🔵', '관심목록': '🟡', '관망': '⚪' };
const SIGNAL_ORDER = ['매수 후보', '관심목록', '관망'];

const GRADE_STYLE = {
    S: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    B: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    C: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    D: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    F: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};
const TIMING_STYLE = {
    '양호': 'text-blue-600 dark:text-blue-400 font-semibold',
    '대기': 'text-amber-600 dark:text-amber-400 font-medium',
    '하락': 'text-orange-600 dark:text-orange-400 font-semibold',
    '관망': 'text-slate-500 dark:text-slate-400',
};

const fmtPrice = (v) => (v == null ? '-' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/**
 * 오늘의 매수후보 (2-2)
 * 자동 전수평가 결과를 투자판정(매수후보>관심목록>관망) 순으로 표시
 */
const DailyPicks = () => {
    const [rows, setRows] = useState([]);
    const [baseDate, setBaseDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [signalFilter, setSignalFilter] = useState('매수 후보');  // 기본: 매수후보만
    const [sortKey, setSortKey] = useState('valueScore');
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

    // 투자판정별 집계
    const counts = useMemo(() => {
        const c = { '매수 후보': 0, '관심목록': 0, '관망': 0 };
        rows.forEach((r) => { if (c[r.investmentSignal] != null) c[r.investmentSignal]++; });
        return c;
    }, [rows]);

    const filtered = useMemo(() => {
        let list = signalFilter === '전체' ? rows : rows.filter((r) => r.investmentSignal === signalFilter);
        list = [...list].sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            if (av == null) return 1;
            if (bv == null) return -1;
            const an = typeof av === 'string' ? parseFloat(av) : av;
            const bn = typeof bv === 'string' ? parseFloat(bv) : bv;
            if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
        return list;
    }, [rows, signalFilter, sortKey, sortDir]);

    const handleSort = (key) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('desc'); }
    };

    const COLUMNS = [
        { key: 'symbol', label: '심볼' },
        { key: 'companyName', label: '기업명' },
        { key: 'investmentSignal', label: '투자판정' },
        { key: 'valueScore', label: '가치등급', num: true },
        { key: 'timingSignal', label: '타이밍' },
        { key: 'currentPrice', label: '현재가', num: true },
        { key: 'fairValue', label: '적정가', num: true },
        { key: 'purchasePrice', label: '매수적정가', num: true },
        { key: 'sector', label: '섹터' },
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
                {SIGNAL_ORDER.map((sig) => (
                    <button
                        key={sig}
                        onClick={() => setSignalFilter(sig)}
                        className={`rounded-lg border px-4 py-3 text-left transition ${
                            signalFilter === sig
                                ? 'border-blue-500 ring-2 ring-blue-400/40'
                                : 'border-slate-200 dark:border-slate-700'
                        } ${SIGNAL_STYLE[sig]}`}
                    >
                        <div className="text-xs font-medium">{SIGNAL_ICON[sig]} {sig}</div>
                        <div className="text-2xl font-bold">{counts[sig]}</div>
                    </button>
                ))}
                <button
                    onClick={() => setSignalFilter('전체')}
                    className={`rounded-lg border px-4 py-3 text-left transition bg-white dark:bg-slate-800 ${
                        signalFilter === '전체' ? 'border-blue-500 ring-2 ring-blue-400/40' : 'border-slate-200 dark:border-slate-700'
                    }`}
                >
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">전체</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{rows.length}</div>
                </button>
            </div>

            <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    {baseDate && `평가 기준일: ${baseDate}`} · 매일 오전 10시 자동 전수평가 결과 · 행 더블클릭 시 기업가치 계산
                    {valueLoadingSymbol && <span className="ml-2 text-blue-600 dark:text-blue-400">({valueLoadingSymbol} 계산 중…)</span>}
                </div>
                <button
                    onClick={fetchData}
                    className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={loading}
                >
                    {loading ? '조회 중…' : '새로고침'}
                </button>
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
                                    key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    className={`px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap ${col.num ? 'text-right' : 'text-left'}`}
                                >
                                    {col.label}
                                    {sortKey === col.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
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
                                <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">{r.symbol}</td>
                                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 max-w-[200px] truncate">{r.companyName || '-'}</td>
                                <td className="px-4 py-2.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${SIGNAL_STYLE[r.investmentSignal] || ''}`}>
                                        {SIGNAL_ICON[r.investmentSignal]} {r.investmentSignal || '-'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${GRADE_STYLE[r.valueGrade] || ''}`}>{r.valueGrade || '-'}</span>
                                    <span className="ml-1 text-xs text-slate-400">{r.valueScore != null ? Number(r.valueScore).toFixed(0) : ''}</span>
                                </td>
                                <td className={`px-4 py-2.5 text-center ${TIMING_STYLE[r.timingSignal] || ''}`}>{r.timingSignal || '-'}</td>
                                <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtPrice(r.currentPrice)}</td>
                                <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtPrice(r.fairValue)}</td>
                                <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtPrice(r.purchasePrice)}</td>
                                <td className="px-4 py-2.5 text-left text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.sector || '-'}</td>
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
