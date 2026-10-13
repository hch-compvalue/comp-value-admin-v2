import Loading from '@/component/common/display/Loading';
import { useCallback, useMemo, useRef, useState } from 'react';

import CompanyValueResultModal from '@/pages/trade/popup/CompanyValueResultModal';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import PageTitle from '@/component/common/display/PageTitle';
import { send, API_ENDPOINTS } from '@/util/ClientUtil';

// ----------------------------------------------
// 유틸리티: URL 빌더 (중복 제거)
// ----------------------------------------------
const buildUrl = (base, params) => {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    return `${base}?${usp.toString()}`;
};

const INITIAL_COMP_LIST = [];

/**
 * 해외 기업 가치 계산
 */
const AbroadCompValue = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [compName, setCompName] = useState('');
    const [compNameData, setCompNameData] = useState(INITIAL_COMP_LIST);
    const [compValueData, setCompValueData] = useState({});
    const [showPopup, setShowPopup] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });

    const openAlert = (message, onConfirm) => {
        setAlertConfig({ open: true, message, onConfirm: onConfirm || null });
    };

    const handleCloseAlert = () => {
        const { onConfirm } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null });
        if (onConfirm) onConfirm();
    };

    const inFlight = useRef({ search: false, calc: false });
    const latestSearchReqId = useRef(0);

    const resultCount = useMemo(() => (Array.isArray(compNameData) ? compNameData.length : 0), [compNameData]);

    const tableHead = useMemo(() => (
        <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-700 to-slate-600 text-white">
            <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">심볼</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">기업명</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">통화</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">거래소</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">시장</th>
            </tr>
        </thead>
    ), []);

    const EmptyState = ({ message }) => (
        <tr>
            <td className="px-4 py-12 text-center" colSpan={5}>
                <div className="flex flex-col items-center gap-3">
                    <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
                </div>
            </td>
        </tr>
    );

    const compSymbolSearch = useCallback(async () => {
        if (!compName.trim()) {
            setCompNameData([]);
            return;
        }

        if (inFlight.current.search) return;
        inFlight.current.search = true;

        setIsLoading(true);

        const reqId = ++latestSearchReqId.current;

        try {
            const q = compName.trim();
            const sendUrl = buildUrl('/dart/abroad/company/search/symbol', { cn: q, symbol: q });
            const { data, error } = await send(sendUrl, {}, 'GET');

            if (reqId !== latestSearchReqId.current) return;

            if (!error && data && data.response) {
                const list = Array.isArray(data.response) ? data.response : [];
                setCompNameData(list);
            } else {
                setCompNameData([]);
            }
        } catch (e) {
            if (reqId !== latestSearchReqId.current) return;
            setCompNameData([]);
        } finally {
            if (reqId === latestSearchReqId.current) setIsLoading(false);
            inFlight.current.search = false;
        }
    }, [compName]);

    const compValueCal = useCallback(
        async (row) => {
            if (!Array.isArray(compNameData) || compNameData.length === 0) {
                openAlert('기업 정보가 존재하지 않습니다.');
                return;
            }

            const symbol = row && row.symbol ? row.symbol.trim() : '';
            if (!symbol) {
                openAlert('심볼 정보가 존재하지 않습니다.');
                return;
            }

            if (inFlight.current.calc) return;
            inFlight.current.calc = true;

            setIsLoading(true);
            try {
                const sendUrl = API_ENDPOINTS.ABROAD_COMP_VALUE(symbol);
                const { data, error } = await send(sendUrl, {}, 'GET');

                const hasValid = !error && data && data.response && Object.keys(data.response).length > 0;
                if (hasValid) {
                    setCompValueData(data.response);
                    setShowPopup(true);
                } else {
                    setCompValueData({});
                    openAlert('조회 결과가 존재하지 않거나 서버 응답을 받지 못했습니다.');
                }
            } catch (e) {
                setCompValueData({});
                openAlert('요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
            } finally {
                setIsLoading(false);
                inFlight.current.calc = false;
            }
        },
        [compNameData]
    );

    const onKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                compSymbolSearch();
            }
        },
        [compSymbolSearch]
    );

    return (
        <>
            <PageTitle />
            {/* <div className="px-2 py-8 md:px-4"> */}
            {/* 헤더 */}

            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">심볼을 검색하고 행을 클릭하면 기업가치 계산 결과를 확인할 수 있습니다.</p>

            <Loading show={isLoading} />

            {/* 검색 영역 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 sm:p-4 mb-4 dark:bg-slate-800 dark:border-slate-700">
                <div className="flex flex-col gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={compName}
                            onChange={(e) => setCompName(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="심볼 또는 회사명으로 검색"
                            className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            aria-label="심볼/회사명 검색"
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={compSymbolSearch}
                            disabled={isLoading || !compName.trim()}
                            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
                        >
                            검색
                        </button>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        {resultCount > 0 && (
                            <span className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium text-xs sm:text-sm whitespace-nowrap">
                                {resultCount}건
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 테이블 영역 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="overflow-x-auto overflow-y-auto scrollbar-always max-h-[65vh]" style={{ scrollbarGutter: 'stable' }}>
                    <table
                        className="text-sm divide-y divide-slate-200 dark:divide-slate-700"
                        style={{ width: '100%', tableLayout: 'fixed' }}
                    >
                        {tableHead}
                        <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                            {Array.isArray(compNameData) && compNameData.length > 0 ? (
                                compNameData.map((row, idx) => (
                                    <tr
                                        key={`${row.symbol || 'row'}-${idx}`}
                                        className="hover:bg-blue-50 cursor-pointer transition-colors dark:hover:bg-slate-700"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => !isLoading && compValueCal(row)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                !isLoading && compValueCal(row);
                                            }
                                        }}
                                        aria-label={`계산 ${row.symbol}`}
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="font-semibold text-slate-900 dark:text-white">{row.symbol}</span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-200">{row.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{row.currency}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{row.exchangeFullName}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                {row.exchange}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <EmptyState message="검색 결과가 없습니다. 상단 입력창에 키워드를 입력하고 Enter 를 눌러보세요." />
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CompanyValueResultModal
                isOpen={showPopup}
                onClose={() => {
                    setShowPopup(false);
                }}
                data={compValueData}
            />


            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={handleCloseAlert}
            />
            {/* </div> */}
        </>
    );
};

export default AbroadCompValue;