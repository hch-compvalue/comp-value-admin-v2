import { useState, useEffect } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';
import { send } from '@/util/ClientUtil';

export default function CompanyInfoModal({ isOpen, onClose, symbol, zIndex = 70 }) {

    const [companyInfo, setCompanyInfo] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && symbol) {
            fetchCompanyInfo();
        }
    }, [isOpen, symbol]);

    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    const fetchCompanyInfo = async () => {
        setLoading(true);
        try {
            const url = `/dart/abroad/company/search/profile?symbol=${encodeURIComponent(symbol)}`;

            const { data, error } = await send(url, {}, 'GET');

            if (error) {
                console.error('API 에러:', error);
                setCompanyInfo(null);
            } else if (data?.success && data?.response) {
                // CommonResponse 형태: response 필드 안에 실제 데이터
                const responseData = data.response;
                if (Array.isArray(responseData) && responseData.length > 0) {
                    setCompanyInfo(responseData[0]);
                } else if (responseData && typeof responseData === 'object') {
                    setCompanyInfo(responseData);
                } else {
                    console.warn('기업정보 데이터 없음:', responseData);
                    setCompanyInfo(null);
                }
            } else {
                console.warn('응답 형식 오류 또는 데이터 없음:', data);
                setCompanyInfo(null);
            }
        } catch (e) {
            console.error('기업정보 조회 실패:', e);
            setCompanyInfo(null);
        } finally {
            setLoading(false);
        }
    };

    if (!shouldRender) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const formatNumber = (num) => {
        if (!num) return '-';
        return num.toLocaleString();
    };

    const formatMarketCap = (marketCap) => {
        if (!marketCap) return '-';
        const billion = marketCap / 1000000000;
        return `$${billion.toFixed(2)}B`;
    };

    return (
        <div
            className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
            style={{ zIndex, animationDuration: '0.25s' }}
            onClick={handleOverlayClick}
        >
            <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-lg bg-white shadow-xl dark:bg-slate-800 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`} style={{ animationDuration: '0.25s' }}>
                {/* 헤더 */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">기업 정보</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 본문 */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400"></div>
                        </div>
                    ) : companyInfo ? (
                        <div className="space-y-6">
                            {/* 기본 정보 */}
                            <div className="flex items-start gap-4">
                                {companyInfo.image && !companyInfo.defaultImage && (
                                    <img
                                        src={companyInfo.image}
                                        alt={companyInfo.companyName}
                                        className="h-16 w-16 rounded-lg object-contain"
                                    />
                                )}
                                <div className="flex-1">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {companyInfo.companyName}
                                    </h3>
                                    <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">{companyInfo.symbol}</span>
                                        <span>•</span>
                                        <span>{companyInfo.exchangeFullName || companyInfo.exchange}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 주가 정보 */}
                            <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50 md:grid-cols-4">
                                <div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">현재가</div>
                                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                                        ${companyInfo.price?.toFixed(2) || '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">변동</div>
                                    <div className={`mt-1 text-lg font-semibold ${companyInfo.change >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                        {companyInfo.change >= 0 ? '+' : ''}{companyInfo.change?.toFixed(2)} ({companyInfo.changePercentage?.toFixed(2)}%)
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">시가총액</div>
                                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                                        {formatMarketCap(companyInfo.marketCap)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">52주 범위</div>
                                    <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                                        {companyInfo.range || '-'}
                                    </div>
                                </div>
                            </div>

                            {/* 회사 정보 */}
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">회사 정보</h4>
                                <div className="space-y-2 text-sm">
                                    {companyInfo.description && (
                                        <div>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">설명:</span>
                                            <p className="mt-1 text-slate-600 dark:text-slate-400">{companyInfo.description}</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                        {companyInfo.ceo && (
                                            <div>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">CEO:</span>
                                                <span className="ml-2 text-slate-600 dark:text-slate-400">{companyInfo.ceo}</span>
                                            </div>
                                        )}
                                        {companyInfo.sector && (
                                            <div>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">섹터:</span>
                                                <span className="ml-2 text-slate-600 dark:text-slate-400">{companyInfo.sector}</span>
                                            </div>
                                        )}
                                        {companyInfo.industry && (
                                            <div>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">산업:</span>
                                                <span className="ml-2 text-slate-600 dark:text-slate-400">{companyInfo.industry}</span>
                                            </div>
                                        )}
                                        {companyInfo.fullTimeEmployees && (
                                            <div>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">직원 수:</span>
                                                <span className="ml-2 text-slate-600 dark:text-slate-400">{formatNumber(parseInt(companyInfo.fullTimeEmployees))}</span>
                                            </div>
                                        )}
                                        {companyInfo.ipoDate && (
                                            <div>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">IPO 날짜:</span>
                                                <span className="ml-2 text-slate-600 dark:text-slate-400">{companyInfo.ipoDate}</span>
                                            </div>
                                        )}
                                        {companyInfo.country && (
                                            <div>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">국가:</span>
                                                <span className="ml-2 text-slate-600 dark:text-slate-400">{companyInfo.country}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 재무 정보 */}
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">재무 정보</h4>
                                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                                    {companyInfo.beta && (
                                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                            <div className="text-xs text-slate-500 dark:text-slate-400">베타</div>
                                            <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                                                {companyInfo.beta.toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                    {companyInfo.lastDividend != null && companyInfo.lastDividend > 0 && (
                                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                            <div className="text-xs text-slate-500 dark:text-slate-400">배당금</div>
                                            <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                                                ${companyInfo.lastDividend.toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                    {companyInfo.averageVolume && (
                                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                            <div className="text-xs text-slate-500 dark:text-slate-400">평균 거래량</div>
                                            <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                                                {formatNumber(companyInfo.averageVolume)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 연락처 정보 */}
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">연락처 정보</h4>
                                <div className="space-y-2 text-sm">
                                    {companyInfo.address && (
                                        <div>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">주소:</span>
                                            <span className="ml-2 text-slate-600 dark:text-slate-400">
                                                {companyInfo.address}, {companyInfo.city}, {companyInfo.state} {companyInfo.zip}, {companyInfo.country}
                                            </span>
                                        </div>
                                    )}
                                    {companyInfo.phone && (
                                        <div>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">전화:</span>
                                            <span className="ml-2 text-slate-600 dark:text-slate-400">{companyInfo.phone}</span>
                                        </div>
                                    )}
                                    {companyInfo.website && (
                                        <div>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">웹사이트:</span>
                                            <a
                                                href={companyInfo.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
                                            >
                                                {companyInfo.website}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <p className="text-slate-500 dark:text-slate-400">기업 정보를 불러올 수 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
