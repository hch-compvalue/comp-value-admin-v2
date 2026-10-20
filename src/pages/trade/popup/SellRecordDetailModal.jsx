import { useState, useEffect } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';
import { send, API_ENDPOINTS } from '@/util/ClientUtil';
import { calcFxPnl, calcTotalPnlKrw } from '@/util/SellRecordUtil';
import CompanyValueResultModal from '@/pages/trade/popup/CompanyValueResultModal';
import AlertModal from '@/component/layouts/common/popup/AlertModal';

export default function SellRecordDetailModal({ isOpen, data, fxRate, onClose }) {
    const [companyProfile, setCompanyProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    
    // 기업 분석 모달 관련 상태
    const [companyValueModal, setCompanyValueModal] = useState({ open: false, data: null });
    const [companyValueLoading, setCompanyValueLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });

    useEffect(() => {
        if (isOpen && data?.symbol) {
            fetchCompanyProfile(data.symbol);
        }
    }, [isOpen, data?.symbol]);

    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    const fetchCompanyProfile = async (symbol) => {
        if (!symbol) return;

        setProfileLoading(true);
        try {
            const { data: response, error } = await send(`/dart/abroad/company/search/profile?symbol=${encodeURIComponent(symbol)}`, {}, 'GET');
            if (!error && response?.success && response?.response && response.response.length > 0) {
                const profile = response.response[0];
                setCompanyProfile(profile);
            } else {
                setCompanyProfile(null);
            }
        } catch (e) {
            console.error('회사 프로필 조회 실패:', e);
            setCompanyProfile(null);
        } finally {
            setProfileLoading(false);
        }
    };
    
    // AlertModal 헬퍼 함수
    const openAlert = (message, onConfirm) => {
        setAlertConfig({ open: true, message, onConfirm: onConfirm || null });
    };

    const handleCloseAlert = () => {
        const { onConfirm } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null });
        if (onConfirm) onConfirm();
    };

    // 기업 분석 모달 열기
    const handleOpenCompanyValue = async () => {

        const symbol = data && data.symbol ? data.symbol.trim() : '';
        if (!symbol) {
            openAlert('심볼 정보가 존재하지 않습니다.');
            return;
        }

        if (companyValueLoading) return;

        setCompanyValueLoading(true);
        try {
            const sendUrl = API_ENDPOINTS.ABROAD_COMP_VALUE(symbol);
            const { data: responseData, error } = await send(sendUrl, {}, 'GET');

            const hasValid = !error && responseData && responseData.response && Object.keys(responseData.response).length > 0;
            if (hasValid) {
                setCompanyValueModal({ open: true, data: responseData.response });
            } else {
                openAlert('조회 결과가 존재하지 않거나 서버 응답을 받지 못했습니다.');
            }
        } catch {
            openAlert('요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setCompanyValueLoading(false);
        }
    };

    if (!shouldRender) return null;

    const sellAmount = data.sellPrice * data.sellQty;
    // 매도당시환율 우선, 없으면 현재환율 사용
    const sellRate = data.sellExchangeRateAtTrade || fxRate;
    const fxPnl = calcFxPnl(data);
    const totalPnl = calcTotalPnlKrw(data, fxRate);

    return (
        <>
            <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}>
            <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`} style={{ animationDuration: '0.25s' }}>
                {/* 헤더 */}
                <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        매도 기록 상세보기
                    </h2>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                            onClick={handleOpenCompanyValue}
                            disabled={companyValueLoading}
                            title="기업가치 계산 결과 보기"
                        >
                            {companyValueLoading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    조회 중...
                                </>
                            ) : (
                                '기업 분석'
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 rounded-lg p-1.5 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* 기본 정보 */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-3">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">기본 정보</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">티커</label>
                                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{data.symbol}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">매도일</label>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">{data.sellDate}</div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">기업명</label>
                            <div className="text-lg font-semibold text-slate-900 dark:text-white">{data.companyName}</div>
                        </div>
                    </div>

                    {/* 매도 상세 정보 */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-3">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">매도 상세</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">매도가 (USD)</label>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                    ${data.sellPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {sellRate && (
                                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        ₩{Math.round(data.sellPrice * sellRate).toLocaleString()}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">매도 수량</label>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {data.sellQty.toLocaleString()}주
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">매도 금액</label>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">
                                ${sellAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {sellRate && (
                                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    ₩{Math.round(sellAmount * sellRate).toLocaleString()}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">실현 손익</label>
                            <div className={`text-xl font-bold ${data.realizedPnl >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {data.realizedPnl >= 0 ? '+' : ''}${data.realizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {sellRate && (
                                <div className={`text-sm mt-1 ${data.realizedPnl >= 0 ? 'text-rose-600/70 dark:text-rose-400/70' : 'text-blue-600/70 dark:text-blue-400/70'}`}>
                                    {data.realizedPnl >= 0 ? '+' : ''}₩{Math.round(data.realizedPnl * sellRate).toLocaleString()}
                                </div>
                            )}
                        </div>

                        {/* 환율 정보 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">매수당시환율</label>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {data.buyExchangeRateAtTrade ? `₩${data.buyExchangeRateAtTrade.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}` : '-'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">매도당시환율</label>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {data.sellExchangeRateAtTrade ? `₩${data.sellExchangeRateAtTrade.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}` : '-'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">환차손익</label>
                            {fxPnl === null ? (
                                <div className="text-lg font-semibold text-slate-400 dark:text-slate-500">-</div>
                            ) : (
                                <div className={`text-lg font-bold ${fxPnl >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                    {fxPnl >= 0 ? '+' : ''}₩{Math.round(fxPnl).toLocaleString()}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">총손익 (가격손익 + 환차손익)</label>
                            {totalPnl === null ? (
                                <div className="text-xl font-bold text-slate-400 dark:text-slate-500">-</div>
                            ) : (
                                <div className={`text-xl font-bold ${totalPnl >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                    {totalPnl >= 0 ? '+' : ''}₩{Math.round(totalPnl).toLocaleString()}
                                </div>
                            )}
                        </div>

                        {data.rmk && (
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">비고</label>
                                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {data.rmk}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 회사 프로필 */}
                    {profileLoading ? (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                            <div className="flex items-center justify-center py-8">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400"></div>
                            </div>
                        </div>
                    ) : companyProfile ? (
                        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                            <div className="flex items-start gap-3 mb-3">
                                {companyProfile.image && !companyProfile.defaultImage && (
                                    <img
                                        src={companyProfile.image}
                                        alt={companyProfile.symbol}
                                        className="w-12 h-12 rounded-lg object-contain bg-white"
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                )}
                                <div className="flex-1">
                                    <h3 className="font-semibold text-slate-900 dark:text-white">{companyProfile.companyName}</h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-300">{companyProfile.exchange} · {companyProfile.sector}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                {companyProfile.price && (
                                    <div>
                                        <div className="text-slate-600 dark:text-slate-400">현재가</div>
                                        <div className="font-semibold text-slate-900 dark:text-white">${companyProfile.price.toFixed(2)}</div>
                                    </div>
                                )}
                                {companyProfile.beta && (
                                    <div>
                                        <div className="text-slate-600 dark:text-slate-400">베타</div>
                                        <div className="font-semibold text-slate-900 dark:text-white">{companyProfile.beta.toFixed(2)}</div>
                                    </div>
                                )}
                                {companyProfile.marketCap && (
                                    <div>
                                        <div className="text-slate-600 dark:text-slate-400">시가총액</div>
                                        <div className="font-semibold text-slate-900 dark:text-white">
                                            ${(companyProfile.marketCap / 1e9).toFixed(2)}B
                                        </div>
                                    </div>
                                )}
                                {companyProfile.lastDividend > 0 && (
                                    <div>
                                        <div className="text-slate-600 dark:text-slate-400">배당</div>
                                        <div className="font-semibold text-slate-900 dark:text-white">${companyProfile.lastDividend.toFixed(2)}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {/* 환율 정보 */}
                    {fxRate && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>환율: 1 USD = ₩{Math.round(fxRate).toLocaleString()}</span>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-700/50 px-6 py-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors font-medium"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
            {/* 기업가치 계산 결과 모달 */}
            <CompanyValueResultModal
                isOpen={companyValueModal.open}
                onClose={() => setCompanyValueModal({ open: false, data: null })}
                data={companyValueModal.data}
                fromInvestmentDetail={false}
            />

            {/* Alert 모달 */}
            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={handleCloseAlert}
            />
        </>
    );
}
