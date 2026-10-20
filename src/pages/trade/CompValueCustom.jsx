import Loading from '@/component/common/display/Loading';
import InputRowList from '@/component/common/input/InputRowList_Number';
import PageTitle from '@/component/common/display/PageTitle';

import { useState } from 'react'
import { send } from '@/util/ClientUtil';


const CompValueCustom = () => {

    const [isLoading, setIsLoading] = useState('');

    const [unit, setUnit] = useState('100000000');

    const [operatingProfitPrePre, setOperatingProfitPrePre] = useState('');     // 전전기 영업이익
    const [operatingProfitPre, setOperatingProfitPre] = useState('');           // 전기 영업이익
    const [operatingProfitCurrent, setOperatingProfitCurrent] = useState('');   // 당기 영업이익

    const [currentAssetsTotal, setCurrentAssetsTotal] = useState('');           // 유동자산 합계
    const [currentLiabilitiesTotal, setCurrentLiabilitiesTotal] = useState(''); // 유동부채 합계
    const [currentRatio, setCurrentRatio] = useState('');                       // 유동비율

    const [investmentAssets, setInvestmentAssets] = useState('');               // 투자자산(비유동자산내)
    const [fixedLiabilities, setFixedLiabilities] = useState('');               // 고정부채(비유동부채)
    const [issuedShares, setIssuedShares] = useState('');                       // 발행주식수

    const [data, setData] = useState('');


    /**
     * 유동비율 계산
     * @returns
     */
    const calculateCurrentRatio = () => {
        const assets = parseFloat(currentAssetsTotal.replace(/,/g, '')) || 0;
        const liabilities = parseFloat(currentLiabilitiesTotal.replace(/,/g, '')) || 0;
        if (liabilities === 0) {
            setCurrentRatio('0');
            return;
        }
        const ratio = (assets / liabilities);
        setCurrentRatio(ratio.toFixed(2));
    };

    /**
     * 파라미터 초기화
     */
    const resetParam = () => {
        setOperatingProfitPrePre('');
        setOperatingProfitPre('');
        setOperatingProfitCurrent('');
        setCurrentAssetsTotal('');
        setCurrentLiabilitiesTotal('');
        setCurrentRatio('');
        setInvestmentAssets('');
        setFixedLiabilities('');
        setIssuedShares('');
        setData('');
    }

    /**
     * 분석
     */
    const fetchData = async () => {

        setIsLoading(true);

        const requestBody = {
            unit: unit,
            operatingProfitPrePre: operatingProfitPrePre,
            operatingProfitPre: operatingProfitPre,
            operatingProfitCurrent: operatingProfitCurrent,
            currentAssetsTotal: currentAssetsTotal,
            currentLiabilitiesTotal: currentLiabilitiesTotal,
            currentRatio: currentRatio,
            investmentAssets: investmentAssets,
            fixedLiabilities: fixedLiabilities,
            issuedShares: issuedShares
        };

        const sendUrl = `/dart/main/cal/per_value/manual`;
        const { data, error } = await send(sendUrl, requestBody, "POST");
        if (data) {
            setData(Number(data.result).toLocaleString());
        } else {
            setData(error);
        }

        setIsLoading(false);
    }


    return (
        <>
            <PageTitle />
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">재무 수치를 직접 입력하여 기업가치를 수동으로 계산합니다.</p>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg p-6 space-y-6">
                <Loading show={isLoading} />

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <button
                        type="button"
                        onClick={fetchData}
                        className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
                    >
                        분석
                    </button>
                    <button
                        type="button"
                        onClick={resetParam}
                        className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg border border-orange-300 bg-white text-orange-600 text-sm font-medium hover:bg-orange-50 active:bg-orange-100 transition-colors whitespace-nowrap dark:bg-slate-700 dark:border-orange-500 dark:text-orange-400 dark:hover:bg-slate-600"
                    >
                        초기화
                    </button>
                    {data !== '' && (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium text-sm dark:bg-blue-900/30 dark:text-blue-300">
                            결과: {data}
                        </span>
                    )}
                </div>

                <InputRowList
                    rows={[
                        ['단위 (Default: 1억)', unit, setUnit],
                        ['전전기 영업이익', operatingProfitPrePre, setOperatingProfitPrePre],
                        ['전기 영업이익', operatingProfitPre, setOperatingProfitPre],
                        ['당기 영업이익', operatingProfitCurrent, setOperatingProfitCurrent],
                        ['유동자산 합계', currentAssetsTotal, setCurrentAssetsTotal],
                        ['유동부채 합계', currentLiabilitiesTotal, setCurrentLiabilitiesTotal],
                        [
                            <span className="flex items-center">
                                유동비율
                                <button
                                    type="button"
                                    onClick={calculateCurrentRatio}
                                    className="ml-2 px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors"
                                >
                                    계산
                                </button>
                            </span>,
                            currentRatio,
                            setCurrentRatio
                        ],
                        ['투자자산(비유동자산내)', investmentAssets, setInvestmentAssets],
                        ['고정부채(비유동부채)', fixedLiabilities, setFixedLiabilities],
                        ['발행주식수', issuedShares, setIssuedShares]
                    ].map(([label, value, setter]) =>
                        [typeof label === 'string' ? <span>{label}</span> : label, value, setter]
                    )}
                />

            </div>
        </>
    )
}

export default CompValueCustom;
