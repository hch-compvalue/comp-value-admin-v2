import { useState, useMemo, useCallback } from 'react'

import { send } from '@/util/ClientUtil';
import Loading from '@/component/common/display/Loading';
import PageTitle from '@/component/common/display/PageTitle';
import Button from '@/component/common/button/Button';

function CompList() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const resultCount = useMemo(() => (Array.isArray(data) ? data.length : 0), [data]);

    const fetchData = useCallback(async () => {
        setLoading(true);

        const sendUrl = "/dart/disclosure/corpCode";
        const { data: resData } = await send(sendUrl, {}, "GET");

        const regex = new RegExp(search, 'i');
        const searchList = resData.list.filter((item) => regex.test(item.corpName));
        setData(searchList);

        setLoading(false);
    }, [search]);

    const onKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchData();
        }
    }, [fetchData]);

    return (
        <>
            <PageTitle />
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">기업명을 검색하여 국내 기업 목록을 조회합니다.</p>

            <Loading show={loading} />

            {/* 검색 영역 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 sm:p-4 mb-4 dark:bg-slate-800 dark:border-slate-700">
                <div className="flex flex-col gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="기업명으로 검색"
                            className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            aria-label="기업명 검색"
                            disabled={loading}
                        />
                        <Button onClick={fetchData} disabled={loading}>
                            검색
                        </Button>
                    </div>
                    {resultCount > 0 && (
                        <div className="flex items-center">
                            <span className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium text-xs sm:text-sm whitespace-nowrap dark:bg-blue-900/30 dark:text-blue-300">
                                {resultCount}건
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* 테이블 영역 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="overflow-x-auto overflow-y-auto scrollbar-always max-h-[65vh]" style={{ scrollbarGutter: 'stable' }}>
                    <table className="text-sm divide-y divide-slate-200 dark:divide-slate-700" style={{ width: '100%', tableLayout: 'fixed' }}>
                        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold">기업코드</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold">기업명</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold">갱신일</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold">종목코드</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                            {Array.isArray(data) && data.length > 0 ? (
                                data.map((row, idx) => (
                                    <tr
                                        key={`${row.corpCode || 'row'}-${idx}`}
                                        className="hover:bg-blue-50 transition-colors dark:hover:bg-slate-700"
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="font-semibold text-slate-900 dark:text-white">{row.corpCode}</span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-200">{row.corpName}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{row.modifyDate}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{row.stockCode}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="px-4 py-12 text-center" colSpan={4}>
                                        <div className="flex flex-col items-center gap-3">
                                            <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">검색 결과가 없습니다. 상단 입력창에 기업명을 입력하고 Enter를 눌러보세요.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )

}

export default CompList;
