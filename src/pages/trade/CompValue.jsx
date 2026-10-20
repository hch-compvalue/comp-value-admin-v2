import Loading from '@/component/common/display/Loading';
import BulkCalcPopup from './popup/BulkCalcPopup';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import PageTitle from '@/component/common/display/PageTitle';
import Button from '@/component/common/button/Button';

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react';

import { getToday } from '@/util/DateUtil'
import { send } from '@/util/ClientUtil';


const CompValue = () => {

    const [compName, setCompName] = useState('');
    const [compCode, setCompCode] = useState('');
    const [baseYear, setBaseYear] = useState(getToday('yyyy'));

    const [rowData, setRowData] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showDetail, setShowDetail] = useState(false);

    const [isPopup, setIsPopup] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });

    const openAlert = (message, onConfirm) => {
        setAlertConfig({ open: true, message, onConfirm: onConfirm || null });
    };

    const handleCloseAlert = () => {
        const { onConfirm } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null });
        if (onConfirm) onConfirm();
    };


    const fetchData = async () => {
        setIsLoading(true);

        const sendUrl = `/dart/main/cal/per_value?corp_name=${compName}&corp_code=${compCode}&year=${baseYear}`;
        const { data, error } = await send(sendUrl, {}, "GET");

        if (error == null) {
            setRowData(data);
        } else {
            setRowData({ '결과메시지': '조회중 오류가 발생했습니다.' });
        }

        setIsLoading(false);
    }

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchData();
        }
    };

    const resultRows = [
        ['결과메시지', rowData ? rowData.결과메시지 : ''],
        ['기업명', rowData ? rowData.기업명 : ''],
        ['기업코드', rowData ? rowData.기업코드 : ''],
        ['주식코드', rowData ? rowData.주식코드 : ''],
        ['주당가치', rowData?.주당가치 ? Number(rowData.주당가치).toLocaleString() : ''],
        ['현재가격', rowData?.현재가격 ? Number(rowData.현재가격).toLocaleString() : ''],
        ['확인시간', rowData ? rowData.확인시간 : ''],
    ];

    const detailEntries = rowData?.상세정보 ? Object.entries(rowData.상세정보) : [];

    return (
        <>
            <PageTitle />
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">당기, 전전기 등 현재년도 기준 아직 재무정보가 없는 경우 가장 최근 재무정보를 한번 더 읽어서 계산하기 때문에 수동계산이랑 값이 다를 수 있음.</p>

            <Loading show={isLoading} />
            {isPopup && (
                <BulkCalcPopup onClose={() => setIsPopup(false)} year={baseYear} openAlert={openAlert} />
            )}

            {/* 검색 카드 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 sm:p-4 mb-4 dark:bg-slate-800 dark:border-slate-700">
                <div className="flex flex-col gap-2 sm:gap-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                            type="text"
                            value={compName}
                            onChange={(e) => setCompName(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="기업명"
                            className="flex-[2] min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            disabled={isLoading}
                        />
                        <input
                            type="text"
                            value={compCode}
                            onChange={(e) => setCompCode(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="기업코드"
                            className="flex-[2] min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            disabled={isLoading}
                        />
                        <input
                            type="text"
                            inputMode="numeric"
                            value={baseYear}
                            onChange={(e) => {
                                const numeric = e.target.value.replace(/[^0-9]/g, '');
                                setBaseYear(numeric.slice(0, 4));
                            }}
                            onKeyDown={onKeyDown}
                            placeholder="기준년도"
                            className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={fetchData} disabled={isLoading}>
                            분석
                        </Button>
                        <Button variant="secondary" onClick={() => setIsPopup(true)} disabled={isLoading}>
                            대량분석
                        </Button>
                    </div>
                </div>
            </div>

            {/* 결과 테이블 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-4 dark:bg-slate-800 dark:border-slate-700">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold w-1/3">항목</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold">값</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {resultRows.map(([label, value], idx) => (
                            <tr key={idx} className="hover:bg-blue-50 transition-colors dark:hover:bg-slate-700">
                                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{label}</td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{value || ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 상세 토글 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <button
                    type="button"
                    onClick={() => setShowDetail((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors dark:text-slate-200 dark:hover:bg-slate-700"
                >
                    <span>상세</span>
                    <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${showDetail ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {showDetail && (
                    <div className="border-t border-slate-200 dark:border-slate-700">
                        {detailEntries.length > 0 ? (
                            <>
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {detailEntries.map(([key, value], idx) => (
                                        <div key={idx} className="flex items-center px-4 py-2.5 hover:bg-blue-50 transition-colors dark:hover:bg-slate-700">
                                            <span className="w-1/3 text-sm font-medium text-slate-700 dark:text-slate-200">{key}</span>
                                            <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mx-4 my-3 px-4 py-2 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300">
                                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    위 수치는 단위 적용이 되어있지 않습니다.
                                </div>
                            </>
                        ) : (
                            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                상세 정보가 없습니다.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={handleCloseAlert}
            />
        </>
    )
}

export default CompValue;
