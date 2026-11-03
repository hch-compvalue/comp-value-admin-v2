import { useState, useEffect, useMemo } from 'react';
import { send } from '@/util/ClientUtil';
import { fmtKrw } from '@/util/MarketUtil';
import PageTitle from '@/component/common/display/PageTitle';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import Button from '@/component/common/button/Button';

const ALL = 'all';
const MONTH_LEN = 7;         // yyyy-MM
const PCT = 100;

// 손익 색 (상승 빨강 / 하락 파랑 — 보유종목 화면과 같은 기준, 적록색약 구분 가능)
const pnlColor = (v) => (v >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400');

/** 실현 수익률 — 매수원가 = 매도금액 − 실현손익 */
const realizedPct = (r) => {
    const sellAmount = (r.sellPrice || 0) * (r.sellQty || 0);
    const cost = sellAmount - (r.realizedPnl || 0);
    return cost > 0 ? ((r.realizedPnl || 0) / cost) * PCT : null;
};

/**
 * 국내 매도기록 (ROADMAP_domestic 5-C) — 원화 전용, 환율 열 없음
 * - 미국 매도기록(SellRecordHistory)은 환차손익 중심이라 별도 화면으로 둔다
 */
export default function KrSellRecordHistory() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [month, setMonth] = useState(ALL);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });

    const openAlert = (message, onConfirm) => setAlertConfig({ open: true, message, onConfirm: onConfirm || null });
    const closeAlert = () => setAlertConfig({ open: false, message: '', onConfirm: null });

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const { data, error } = await send('/dart/sellrecord', {}, 'GET');
            const list = !error && data?.success && Array.isArray(data.response) ? data.response : [];
            setRecords(list.filter((r) => r.market === 'KR'));
            if (error) openAlert(error);
        } finally {
            setLoading(false);
        }
    };

    // 최초 1회 조회 (fetchRecords 는 매 렌더 새로 생성)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchRecords(); }, []);

    const months = useMemo(() => [...new Set(records.map((r) => (r.sellDate || '').substring(0, MONTH_LEN)).filter(Boolean))].sort().reverse(), [records]);

    const rows = useMemo(() => records
        .filter((r) => month === ALL || (r.sellDate || '').startsWith(month))
        .sort((a, b) => (b.sellDate || '').localeCompare(a.sellDate || '')), [records, month]);

    const stats = useMemo(() => {
        const sellAmount = rows.reduce((s, r) => s + (r.sellPrice || 0) * (r.sellQty || 0), 0);
        const pnl = rows.reduce((s, r) => s + (r.realizedPnl || 0), 0);
        const wins = rows.filter((r) => (r.realizedPnl || 0) > 0).length;
        return { sellAmount, pnl, count: rows.length, winRate: rows.length ? (wins / rows.length) * PCT : null };
    }, [rows]);

    const handleDelete = (id) => openAlert('정말 삭제하시겠습니까?', async () => {
        const { data, error } = await send('/dart/sellrecord/del', { id }, 'POST');
        if (error || !data?.success) {
            setTimeout(() => openAlert(error || '삭제에 실패했습니다.'), 0);
            return;
        }
        fetchRecords();
    });

    const card = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm';
    const th = 'px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300';
    const td = 'px-3 py-2.5 text-sm tabular-nums';

    return (
        <>
            <PageTitle />
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                국내 매도기록입니다. 보유종목(국내)에서 매도하면 자동으로 기록됩니다. 금액은 모두 원화입니다.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className={card}>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">매도 건수</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-white">{stats.count}건</div>
                </div>
                <div className={card}>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">총 매도금액</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">{fmtKrw(stats.sellAmount)}</div>
                </div>
                <div className={card}>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">실현손익 합계</div>
                    <div className={`text-lg font-bold tabular-nums ${pnlColor(stats.pnl)}`}>{fmtKrw(stats.pnl, { signed: true })}</div>
                </div>
                <div className={card}>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">수익 건 비율</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-white">{stats.winRate == null ? '-' : `${stats.winRate.toFixed(0)}%`}</div>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
                <label htmlFor="kr-sell-month" className="text-sm text-slate-600 dark:text-slate-300">기간</label>
                <select id="kr-sell-month" value={month} onChange={(e) => setMonth(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    <option value={ALL}>전체 기간</option>
                    {months.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto dark:bg-slate-800 dark:border-slate-700">
                <table className="w-full min-w-[760px]">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className={`${th} text-left`}>매도일</th>
                            <th className={`${th} text-left`}>종목</th>
                            <th className={`${th} text-right`}>매도가</th>
                            <th className={`${th} text-right`}>수량</th>
                            <th className={`${th} text-right`}>매도금액</th>
                            <th className={`${th} text-right`}>실현손익</th>
                            <th className={`${th} text-left`}>비고</th>
                            <th className={`${th} text-center`}>관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {rows.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                                {loading ? '불러오는 중…' : '국내 매도기록이 없습니다.'}
                            </td></tr>
                        ) : rows.map((r) => {
                            const pct = realizedPct(r);
                            return (
                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                                    <td className={`${td} text-slate-600 dark:text-slate-300`}>{r.sellDate}</td>
                                    <td className={`${td} text-left`}>
                                        <div className="font-medium text-slate-900 dark:text-white">{r.companyName || '-'}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{r.symbol}</div>
                                    </td>
                                    <td className={`${td} text-right text-slate-700 dark:text-slate-200`}>{fmtKrw(r.sellPrice)}</td>
                                    <td className={`${td} text-right text-slate-700 dark:text-slate-200`}>{r.sellQty}주</td>
                                    <td className={`${td} text-right text-slate-700 dark:text-slate-200`}>{fmtKrw((r.sellPrice || 0) * (r.sellQty || 0))}</td>
                                    <td className={`${td} text-right font-semibold ${pnlColor(r.realizedPnl || 0)}`}>
                                        {fmtKrw(r.realizedPnl || 0, { signed: true })}
                                        {pct != null && <div className="text-xs font-normal">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</div>}
                                    </td>
                                    <td className={`${td} text-slate-600 dark:text-slate-300 max-w-[12rem] truncate`} title={r.rmk || ''}>{r.rmk || '-'}</td>
                                    <td className={`${td} text-center`}>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>삭제</Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <AlertModal open={alertConfig.open} message={alertConfig.message} onClose={closeAlert} onConfirm={alertConfig.onConfirm} />
        </>
    );
}
