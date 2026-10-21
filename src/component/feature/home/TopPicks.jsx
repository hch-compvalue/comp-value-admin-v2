import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { send } from '@/util/ClientUtil';
import { STOCK_DISCOVER_PATH } from '@/config/menuPaths';
import { GRADE_STYLE } from '@/util/GradeStyleUtil';
import { PENDING_LABEL, RANK_PENDING_TITLE, PENDING_BADGE } from '@/util/ValidationGuide';
import { BUY_TARGET_LABEL, BUY_TARGET_NOTE, selectBuyTargets } from '@/util/BuyTargetUtil';

// 홈에 보여줄 매수 대상 종목 수
const TOP_COUNT = 5;
// 종목 발굴 화면 기본값과 같게 금융 제외
const EXCLUDE_FINANCIAL = true;

const fmtPrice = (v) => (v == null ? '-' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/** 오늘의 매수 대상 중 투자 순위 상위 N개 (종목 발굴 화면 '매수 대상' 기본 목록과 같은 기준) */
export default function TopPicks() {
    const [rows, setRows] = useState([]);
    const [baseDate, setBaseDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            const { data, error } = await send('/dart/main/evaluation/daily', null, 'GET');
            if (error) {
                setError(error);
            } else {
                const list = data?.response || [];
                setRows(selectBuyTargets(list, EXCLUDE_FINANCIAL).slice(0, TOP_COUNT));
                setBaseDate(list[0]?.snapshotDate || '');
            }
            setLoading(false);
        })();
    }, []);

    return (
        <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-baseline justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
                    <span title={BUY_TARGET_NOTE}>{BUY_TARGET_LABEL} 상위 {TOP_COUNT}</span>
                    <span className={`${PENDING_BADGE} ml-2 align-middle`} title={RANK_PENDING_TITLE}>{PENDING_LABEL}</span>
                    {baseDate && <span className="ml-2 text-xs font-normal text-slate-400">{baseDate} 기준</span>}
                </h2>
                <Link to={STOCK_DISCOVER_PATH} className="text-xs text-brand hover:underline dark:text-blue-400">전체 보기</Link>
            </div>

            {loading ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">불러오는 중...</div>
            ) : error ? (
                <div className="px-4 py-8 text-center text-sm text-orange-600 dark:text-orange-400">{error}</div>
            ) : rows.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">오늘 매수 대상이 없습니다.</div>
            ) : (
                <table className="w-full text-sm">
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={r.symbol} className="border-t border-slate-100 first:border-t-0 dark:border-slate-700">
                                <td className="w-10 py-2.5 pl-4 text-right text-slate-400">{i + 1}</td>
                                <td className="py-2.5 pl-3 font-semibold text-slate-900 dark:text-white">{r.symbol}</td>
                                <td className="max-w-[180px] truncate py-2.5 pl-3 text-slate-600 dark:text-slate-300">{r.companyName || '-'}</td>
                                <td className="py-2.5 pl-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${GRADE_STYLE[r.valueGrade] || ''}`} title="가치등급">
                                        {r.valueGrade || '-'}
                                    </span>
                                </td>
                                <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-300">{fmtPrice(r.currentPrice)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
