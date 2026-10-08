import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';
import Toast from '@/component/common/display/Toast';
import StockChartModal from './StockChartModal';
import CompanyInfoModal from './CompanyInfoModal';
import InvestmentDetailModal, { FullDetailModal } from './InvestmentDetailModal';
import { send } from '@/util/ClientUtil';

// 투자판정 배너 스타일 (색각이상 친화: 파랑/노랑/회색) — DailyPicks SIGNAL_STYLE과 동일 팔레트
const SIGNAL_BANNER_STYLE = {
    '매수 후보': 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    '관심목록': 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    '관망': 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700/30 dark:text-slate-300',
};
const SIGNAL_ICON = { '매수 후보': '🔵', '관심목록': '🟡', '관망': '⚪' };

/**
 * 기업가치 계산 결과 모달 컴포넌트
 */
const CompanyValueResultModal = ({ isOpen, onClose, data, fromInvestmentDetail = false }) => {
    const popupRef = useRef(null);
    const [toast, setToast] = useState(null);
    const [overlays, setOverlays] = useState({
        guide: false,
        detail: false,
        chart: false,
        companyInfo: false,
        investmentDetail: false,
        investmentFullDetail: false
    });
    const [investmentData, setInvestmentData] = useState(null);
    const [investmentLoading, setInvestmentLoading] = useState(false);
    const [detailView, setDetailView] = useState({
        title: '',
        data: null
    });
    const [predictionData, setPredictionData] = useState(null);
    const [predictionLoading, setPredictionLoading] = useState(false);

    // Toast auto-hide
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 1800);
        return () => clearTimeout(timer);
    }, [toast]);

    // 모달이 닫힐 때 데이터 초기화
    useEffect(() => {
        if (!isOpen) {
            setPredictionData(null);
            setInvestmentData(null);
        }
    }, [isOpen]);

    // 모달이 열릴 때 투자판단 데이터 자동 조회
    useEffect(() => {
        if (!isOpen || !data || investmentData) return;

        const getValDeep = (obj, keys) => {
            if (!obj || typeof obj !== 'object') return undefined;
            for (const key of keys) {
                if (obj[key] != null) return obj[key];
            }
            return undefined;
        };
        const sym = getValDeep(data, ['symbol', 'ticker', 'code', '주식코드', '주식심볼', '기업심볼']);
        if (!sym) return;

        let cancelled = false;
        (async () => {
            try {
                const { data: responseData, error } = await send('/dart/main/evaluate/stocks', { symbols: [sym] }, 'POST');
                if (!cancelled && !error && responseData?.response?.length > 0) {
                    setInvestmentData(responseData.response[0]);
                }
            } catch {
                // 자동 조회 실패는 무시
            }
        })();

        return () => { cancelled = true; };
    }, [isOpen, data, investmentData]);

    // ESC key handler
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e) => {
            if (e.key !== 'Escape') return;

            if (overlays.investmentFullDetail) {
                setOverlays(prev => ({ ...prev, investmentFullDetail: false }));
            } else if (overlays.investmentDetail) {
                setOverlays(prev => ({ ...prev, investmentDetail: false }));
            } else if (overlays.companyInfo) {
                setOverlays(prev => ({ ...prev, companyInfo: false }));
            } else if (overlays.chart) {
                setOverlays(prev => ({ ...prev, chart: false }));
            } else if (overlays.detail) {
                setOverlays(prev => ({ ...prev, detail: false }));
            } else if (overlays.guide) {
                setOverlays(prev => ({ ...prev, guide: false }));
            } else {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, overlays, onClose]);

    // 클립보드 복사 핸들러
    const handleCopyToClipboard = useCallback(async (content, successMessage) => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(content, null, 2));
            setToast(successMessage);
        } catch {
            setToast('복사에 실패했습니다.');
        }
    }, []);

    // 상세보기 열기
    const openDetailView = useCallback((title, data) => {
        setDetailView({ title, data });
        setOverlays(prev => ({ ...prev, detail: true }));
    }, []);

    // 오버레이 닫기
    const closeOverlay = useCallback((overlayName) => {
        setOverlays(prev => ({ ...prev, [overlayName]: false }));
    }, []);

    // 기업정보 모달 열기
    const handleOpenCompanyInfo = useCallback(() => {
        setOverlays(prev => ({ ...prev, companyInfo: true }));
    }, []);

    // 투자 판단 모달 열기 (이미 데이터가 있으면 바로 열기, 없으면 API 호출)
    const handleOpenInvestmentDetail = useCallback(async (symbol) => {
        if (!symbol || investmentLoading) return;

        if (investmentData) {
            setOverlays(prev => ({ ...prev, investmentDetail: true }));
            return;
        }

        setInvestmentLoading(true);
        try {
            const { data: responseData, error } = await send('/dart/main/evaluate/stocks', { symbols: [symbol] }, 'POST');

            if (!error && responseData && responseData.response && responseData.response.length > 0) {
                setInvestmentData(responseData.response[0]);
                setOverlays(prev => ({ ...prev, investmentDetail: true }));
            } else {
                setToast('투자 판단 데이터를 불러올 수 없습니다.');
            }
        } catch {
            setToast('투자 판단 데이터 조회 중 오류가 발생했습니다.');
        } finally {
            setInvestmentLoading(false);
        }
    }, [investmentLoading, investmentData]);

    // 투자 판단 전체 상세 모달 열기
    const handleOpenInvestmentFullDetail = useCallback((detailData) => {
        setOverlays(prev => ({ ...prev, investmentFullDetail: true }));
    }, []);

    // AI 예측 데이터 조회
    const handleFetchPrediction = useCallback(async (symbol) => {
        if (!symbol || predictionLoading) return;

        setPredictionLoading(true);
        try {
            const { data: responseData, error } = await send(`/dart/ml/predict/w?symbol=${encodeURIComponent(symbol)}`, {}, 'GET');

            if (!error && responseData && responseData.response) {
                setPredictionData(responseData.response);
                setToast('AI 예측 조회 완료');
            } else {
                setToast(responseData?.message || 'AI 예측 조회 실패');
                setPredictionData(null);
            }
        } catch (e) {
            setToast('AI 예측 조회 중 오류가 발생했습니다.');
            setPredictionData(null);
        } finally {
            setPredictionLoading(false);
        }
    }, [predictionLoading]);

    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    if (!shouldRender) return null;

    // 심볼과 회사명 추출
    const getValDeep = (obj, keys) => {
        if (!obj || typeof obj !== 'object') return undefined;
        for (const key of keys) {
            if (obj[key] != null) return obj[key];
        }
        return undefined;
    };
    const symbol = getValDeep(data, ['symbol', 'ticker', 'code', '주식코드', '주식심볼', '기업심볼']);
    const companyName = getValDeep(data, ['companyName', 'name', 'company', '기업명']);

    return (
        <>
            {/* 배경 오버레이 */}
            <div className={`fixed inset-0 bg-black/50 dark:bg-black/70 z-[100] animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }} onClick={onClose} />

            {/* 메인 모달 */}
            <div
                ref={popupRef}
                className={`fixed z-[110] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-xl rounded-md max-h-[90vh] w-[min(900px,90vw)] overflow-y-auto overflow-x-hidden dark:bg-slate-800 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`}
                style={{ animationDuration: '0.25s' }}
                onClick={(e) => e.stopPropagation()}
            >
                <ModalHeader
                    onClose={onClose}
                    onOpenCompanyInfo={handleOpenCompanyInfo}
                    symbol={symbol}
                />
                <ModalContent
                    data={data}
                    onCopy={handleCopyToClipboard}
                    onClose={onClose}
                    onOpenGuide={() => setOverlays(prev => ({ ...prev, guide: true }))}
                    onOpenDetail={openDetailView}
                    onOpenChart={() => setOverlays(prev => ({ ...prev, chart: true }))}
                    onOpenInvestmentDetail={handleOpenInvestmentDetail}
                    investmentLoading={investmentLoading}
                    fromInvestmentDetail={fromInvestmentDetail}
                    predictionData={predictionData}
                    predictionLoading={predictionLoading}
                    onFetchPrediction={handleFetchPrediction}
                    investmentData={investmentData}
                />
            </div>

            {/* 해석 가이드 오버레이 */}
            {overlays.guide && (
                <GuideOverlay onClose={() => closeOverlay('guide')} data={data} />
            )}

            {/* 상세보기 오버레이 */}
            {overlays.detail && (
                <DetailOverlay
                    title={detailView.title}
                    data={detailView.data}
                    onClose={() => closeOverlay('detail')}
                    onCopy={handleCopyToClipboard}
                />
            )}

            {/* 차트 모달 */}
            <StockChartModal
                isOpen={overlays.chart}
                onClose={() => closeOverlay('chart')}
                symbol={symbol}
                companyName={companyName}
            />

            {/* 기업정보 모달 */}
            <CompanyInfoModal
                isOpen={overlays.companyInfo}
                onClose={() => closeOverlay('companyInfo')}
                symbol={symbol}
                zIndex={140}
            />

            {/* 투자 판단 상세 모달 */}
            <InvestmentDetailModal
                isOpen={overlays.investmentDetail}
                data={investmentData}
                onClose={() => closeOverlay('investmentDetail')}
                onOpenFullDetail={handleOpenInvestmentFullDetail}
                zIndex={140}
                fromCompanyValue={true}
            />

            {/* 투자 판단 전체 상세 모달 */}
            <FullDetailModal
                isOpen={overlays.investmentFullDetail}
                data={investmentData}
                onClose={() => closeOverlay('investmentFullDetail')}
                zIndex={140}
            />

            {/* Toast 알림 */}
            <Toast message={toast} />
        </>
    );
};

/**
 * 모달 헤더
 */
const ModalHeader = ({ onClose, onOpenCompanyInfo, symbol }) => (
    <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b bg-white z-10 dark:bg-slate-800 dark:border-slate-700">
        <h2 className="text-lg font-semibold dark:text-white">기업가치 계산 결과</h2>
        <div className="flex items-center gap-2">
            {symbol && (
                <button
                    className="text-sm px-3 py-1 border rounded bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/50"
                    onClick={onOpenCompanyInfo}
                >
                    기업정보
                </button>
            )}
            <button
                className="text-sm px-2 py-1 border rounded hover:bg-gray-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                onClick={onClose}
            >
                닫기 (Esc)
            </button>
        </div>
    </div>
);

/**
 * 모달 메인 콘텐츠
 */
const ModalContent = ({
    data,
    onCopy,
    onClose,
    onOpenGuide,
    onOpenDetail,
    onOpenChart,
    onOpenInvestmentDetail,
    investmentLoading,
    fromInvestmentDetail = false,
    predictionData,
    predictionLoading,
    onFetchPrediction,
    investmentData
}) => {
    const compValueData = data || {};
    const hasData = Object.keys(compValueData).length > 0;

    if (!hasData) {
        return (
            <div className="p-4">
                <p className="text-sm text-gray-600 dark:text-slate-400">표시할 데이터가 없습니다.</p>
            </div>
        );
    }

    const metrics = useCompanyMetrics(compValueData, investmentData);

    return (
        <div className="p-4 space-y-4">
            <CompanySummary data={compValueData} investmentData={investmentData} />
            <MetricExplanation onOpenGuide={onOpenGuide} 매출기반평가={metrics.매출기반평가} />
            <RecommendationBanner data={compValueData} investmentData={investmentData} />
            <HighlightCards data={compValueData} />
            <OvervaluationBanner data={compValueData} />
            <AIPredictionSection
                data={compValueData}
                predictionData={predictionData}
                predictionLoading={predictionLoading}
                onFetchPrediction={onFetchPrediction}
            />
            <DataGrid data={compValueData} onOpenDetail={onOpenDetail} predictionData={predictionData} />
            <ActionButtons
                data={compValueData}
                onCopy={onCopy}
                onClose={onClose}
                onOpenChart={onOpenChart}
                onOpenInvestmentDetail={onOpenInvestmentDetail}
                investmentLoading={investmentLoading}
                fromInvestmentDetail={fromInvestmentDetail}
            />
        </div>
    );
};

/**
 * 기업 요약 정보
 */
const CompanySummary = ({ data, investmentData }) => {
    const metrics = useCompanyMetrics(data, investmentData);

    return (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{metrics.symbol || ''}</div>
                <div className="text-xl font-semibold text-slate-800 dark:text-white">{metrics.name || '결과 요약'}</div>
            </div>
            <MetricBadges metrics={metrics} data={data} />
        </div>
    );
};

/**
 * 지표 배지들 (지표값만 표시, 투자 권장/고려 라벨 제거)
 */
const MetricBadges = ({ metrics, data }) => {
    const { per, perAdj, peg, eps, psr, 매출기반평가, grahamGrade } = metrics;

    // 데이터에서 플래그 확인 (중첩 객체 포함)
    const getValDeep = (obj, keys) => {
        if (!obj || typeof obj !== 'object') return undefined;
        for (const key of keys) {
            if (obj[key] != null) return obj[key];
        }
        const containers = ['상세', '상세정보', 'detail', 'details', 'metric', 'metrics', 'valuation', 'summary', 'data'];
        for (const container of containers) {
            if (obj[container] && typeof obj[container] === 'object') {
                for (const key of keys) {
                    if (obj[container][key] != null) return obj[container][key];
                }
            }
        }
        return undefined;
    };

    const 수익가치계산불가 = getValDeep(data, ['수익가치계산불가', 'earningsNotAvailable', 'isEarningsNotAvailable']) === true;

    // PEG 포맷 함수 (999인 경우 N/A 표시)
    const formatPEG = (value) => {
        if (value === null) return null;
        if (value === 999 || Math.abs(value - 999) < 0.01) return 'N/A';
        return formatNumber(value, 2);
    };

    return (
        <div className="flex gap-2 flex-wrap">
            {per !== null && (
                <Badge title="Price / Earnings">
                    PER {formatNumber(per, 2)}
                </Badge>
            )}
            {매출기반평가 && psr !== null && (
                <Badge title="Price / Sales Ratio">
                    PSR {formatNumber(psr, 2)}
                </Badge>
            )}
            {!매출기반평가 && !수익가치계산불가 && perAdj !== null && (
                <Badge title="성장률 보정 PER">
                    성장률 보정 PER {formatNumber(perAdj, 2)}
                </Badge>
            )}
            {peg !== null && (
                <Badge title="Price / Earnings to Growth (PEG)">
                    PEG {formatPEG(peg)}
                </Badge>
            )}
            {eps !== null && (
                <Badge>
                    EPS(TTM) {formatNumber(eps, 2)}
                </Badge>
            )}
            {grahamGrade && grahamGrade !== 'N/A' && (
                <Badge
                    title="그레이엄 스크리닝 등급"
                    highlighted={grahamGrade === '강력매수' || grahamGrade === '매수'}
                >
                    그레이엄 {grahamGrade}
                </Badge>
            )}
        </div>
    );
};

/**
 * 배지 컴포넌트
 */
const Badge = ({ children, title, highlighted = false }) => {
    const colorClass = highlighted === 'amber'
        ? 'text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-900/30'
        : highlighted
            ? 'text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-900/30'
            : 'text-slate-700 bg-slate-50 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600';

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${colorClass}`}
            title={title}
        >
            {children}
        </span>
    );
};

/**
 * 지표 설명 섹션 (PEG 또는 PSR)
 */
const MetricExplanation = ({ onOpenGuide, 매출기반평가 }) => (
    <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
            {매출기반평가
                ? '💡 PSR = 시가총액 ÷ 매출액 — PSR이 2 이하이면 매출 대비 저평가, 2 이상이면 고평가 가능'
                : '💡 PEG = PER ÷ 이익성장률(%) — PEG가 1 이하이면 성장 대비 저평가, 1 이상이면 고평가 가능'
            }
        </p>
        <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            title="해석 요약 보기"
        >
            <InfoIcon />
            해석 요약
        </button>
    </div>
);

/**
 * 투자판정 배너 (가치등급 × 타이밍 → 투자판정, 오늘의 매수후보와 동일 기준)
 */
const RecommendationBanner = ({ data, investmentData }) => {
    const metrics = useCompanyMetrics(data, investmentData);

    // 투자판단 데이터 로딩 전에는 배너 미표시
    if (!metrics.valueGrade || !metrics.investmentSignal) return null;

    const scoreText = metrics.valueScore != null ? ` (${Number(metrics.valueScore).toFixed(1)}점)` : '';
    const timingText = metrics.timingSignal ? ` · 타이밍 ${metrics.timingSignal}` : '';
    const style = SIGNAL_BANNER_STYLE[metrics.investmentSignal] || SIGNAL_BANNER_STYLE['관망'];

    return (
        <div className={`mt-2 w-full rounded-md border px-3 py-2 text-[13px] ${style}`}>
            {`📊 가치 ${metrics.valueGrade}등급${scoreText}${timingText} → `}
            <span className="font-semibold">{SIGNAL_ICON[metrics.investmentSignal]} {metrics.investmentSignal}</span>
        </div>
    );
};

/**
 * AI 예측 섹션
 */
const AIPredictionSection = ({ data, predictionData, predictionLoading, onFetchPrediction }) => {
    // 심볼 추출
    const getValDeep = (obj, keys) => {
        if (!obj || typeof obj !== 'object') return undefined;
        for (const key of keys) {
            if (obj[key] != null) return obj[key];
        }
        return undefined;
    };

    // data에서 예측데이터 추출 (백엔드에서 올 수도 있음)
    const backendPrediction = getValDeep(data, ['예측데이터', 'predictionData', 'prediction']);
    const displayPrediction = predictionData || backendPrediction;

    const symbol = getValDeep(data, ['symbol', 'ticker', 'code', '주식코드', '주식심볼', '기업심볼']);

    const handlePredict = () => {
        if (symbol) {
            onFetchPrediction(symbol);
        }
    };

    return (
        <div className="rounded-lg border bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-purple-700 p-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        AI 예측
                    </h3>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">(AI) 1주내 예측</p>
                </div>
                {!displayPrediction && (
                    <button
                        type="button"
                        onClick={handlePredict}
                        disabled={predictionLoading || !symbol}
                        className="px-3 py-1.5 text-xs rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        {predictionLoading ? (
                            <>
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                예측 중...
                            </>
                        ) : (
                            <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                예측하기
                            </>
                        )}
                    </button>
                )}
            </div>

            {displayPrediction ? (
                <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <div className="rounded-lg bg-white dark:bg-purple-800/30 p-3 shadow-sm">
                            <div className="text-xs text-purple-600 dark:text-purple-300">예측 시점 현재가</div>
                            <div className="mt-1 text-lg font-semibold text-purple-900 dark:text-white">
                                {displayPrediction.currentPrice ? `$${formatNumber(displayPrediction.currentPrice, 2)}` : '-'}
                            </div>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-purple-800/30 p-3 shadow-sm">
                            <div className="text-xs text-purple-600 dark:text-purple-300">1주 내 예측 최고가</div>
                            <div className="mt-1 text-lg font-semibold text-sky-600 dark:text-sky-400">
                                {displayPrediction.predictedHigh ? `$${formatNumber(displayPrediction.predictedHigh, 2)}` : '-'}
                            </div>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-purple-800/30 p-3 shadow-sm">
                            <div className="text-xs text-purple-600 dark:text-purple-300">1주 내 예측 최저가</div>
                            <div className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">
                                {displayPrediction.predictedLow ? `$${formatNumber(displayPrediction.predictedLow, 2)}` : '-'}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            <div className="text-purple-700 dark:text-purple-300">
                                <span className="font-medium">예측일:</span> {displayPrediction.predictionDate || '-'}
                            </div>
                            <div className="text-purple-700 dark:text-purple-300">
                                <span className="font-medium">소스:</span> {displayPrediction.source === 'database' ? 'DB' : displayPrediction.source === 'realtime' ? '실시간' : displayPrediction.source || '-'}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            <div className="text-purple-700 dark:text-purple-300">
                                <span className="font-medium">대상 기간:</span> {displayPrediction.targetStartDate || '-'} ~ {displayPrediction.targetEndDate || '-'}
                            </div>
                            <div className="text-purple-700 dark:text-purple-300">
                                <span className="font-medium">모델:</span> {displayPrediction.modelVersion || '-'}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                !predictionLoading && (
                    <div className="text-center py-3 text-sm text-purple-600 dark:text-purple-400">
                        예측하기 버튼을 클릭하여 AI 예측 데이터를 조회하세요
                    </div>
                )
            )}
        </div>
    );
};

/**
 * 하이라이트 카드들
 */
const HighlightCards = ({ data }) => {
    const { price, target, calculatedTarget, purchasePrice, sellTarget, stopLossPrice, upside } = usePriceMetrics(data);

    const priceNum = toNumber(price);
    const targetNum = toNumber(target);
    const purchaseNum = toNumber(purchasePrice);
    const sellNum = toNumber(sellTarget);
    const stopLossNum = toNumber(stopLossPrice);

    // 계산된 주당가치가 적정가와 다를 때만 표시
    const showCalculatedTarget = (() => {
        if (calculatedTarget === null) return false;
        if (isNaN(targetNum)) return true;
        return Math.abs(calculatedTarget - targetNum) > 0.01;
    })();

    // 상승여력 색상
    const upsidePct = upside !== null ? (upside * 100).toFixed(1) : null;
    const upsideColor = upside !== null
        ? (upside >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')
        : '';

    // 현재가 대비 % 차이
    const pctDiff = (val) => {
        const v = toNumber(val);
        if (isNaN(v) || isNaN(priceNum) || priceNum === 0) return null;
        return ((v - priceNum) / priceNum * 100).toFixed(1);
    };

    // 프로그레스 바: min=손절매가, max=적정가
    const barMin = stopLossNum;
    const barMax = targetNum;
    const barRange = barMax - barMin;
    const toBarPct = (v) => {
        if (isNaN(v) || isNaN(barMin) || isNaN(barMax) || barRange <= 0) return null;
        return Math.max(0, Math.min(100, ((v - barMin) / barRange) * 100));
    };

    const currentPct = toBarPct(priceNum);
    const purchaseBarPct = toBarPct(purchaseNum);
    const sellBarPct = toBarPct(sellNum);
    const hasBar = currentPct !== null;

    // 마커는 반투명 처리하여 겹쳐도 양쪽 다 보이게 함

    // 트레이딩 가이드 항목
    const guideItems = [
        { label: '손절매가', value: stopLossPrice, color: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
        { label: '매수적정가', value: purchasePrice, color: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
        { label: '목표매도가', value: sellTarget, color: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' },
    ];

    return (
        <div className="flex flex-col gap-3">
            {/* 섹션 1: 가치 평가 */}
            <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-slate-700 dark:border-slate-600">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">가치 평가</div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* 현재가 */}
                    <div className="flex-1 text-center sm:text-left">
                        <div className="text-xs text-slate-500 dark:text-slate-400">현재가</div>
                        <div className="mt-1 text-xl font-bold dark:text-white">{formatUSD(price)}</div>
                    </div>
                    {/* 상승여력 화살표 */}
                    <div className="flex-shrink-0 text-center">
                        {upsidePct !== null && (
                            <div className={`text-lg font-bold ${upsideColor}`}>
                                {upside >= 0 ? '▲' : '▼'} {upside >= 0 ? '+' : ''}{upsidePct}%
                            </div>
                        )}
                    </div>
                    {/* 적정가 */}
                    <div className="flex-1 text-center sm:text-right">
                        <div className="text-xs text-slate-500 dark:text-slate-400">적정가</div>
                        <div className="mt-1 text-xl font-bold dark:text-white">{formatUSD(target)}</div>
                        {showCalculatedTarget && (
                            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                계산된 주당가치: <span className="font-medium text-slate-600 dark:text-slate-300">{formatUSD(calculatedTarget)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 섹션 2: 트레이딩 가이드 */}
            <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-slate-700 dark:border-slate-600">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">트레이딩 가이드</div>
                {/* 가격 리스트 */}
                <div className="space-y-2">
                    {guideItems.map(({ label, value, color, dotColor }) => {
                        const diff = pctDiff(value);
                        return (
                            <div key={label} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
                                    <span className="text-slate-600 dark:text-slate-300">{label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`font-semibold ${color}`}>{formatUSD(value)}</span>
                                    {diff !== null && (
                                        <span className={`text-xs ${Number(diff) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            ({Number(diff) >= 0 ? '+' : ''}{diff}%)
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* 프로그레스 바 */}
                {hasBar && (
                    <div className="mt-6 mb-2">
                        <div className="relative h-2.5 rounded-full bg-slate-200 dark:bg-slate-600">
                            {/* 바 배경 그라데이션 */}
                            <div
                                className="absolute inset-0 rounded-full"
                                style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)' }}
                            />
                            {/* 매수적정가 마커 */}
                            {purchaseBarPct !== null && (
                                <div className="group/m absolute cursor-pointer" style={{ left: `${purchaseBarPct}%`, top: '-5px', bottom: '-5px', width: '10px', transform: 'translateX(-50%)', zIndex: 14 }}>
                                    <div className="absolute rounded-sm transition-all group-hover/m:scale-x-150 group-hover/m:opacity-100" style={{ left: '3px', right: '3px', top: 0, bottom: 0, background: '#10b981', boxShadow: '0 0 4px rgba(16,185,129,0.6)', opacity: 0.85 }} />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2.5 py-1.5 bg-emerald-700 text-white text-[11px] font-medium rounded shadow-lg opacity-0 invisible group-hover/m:opacity-100 group-hover/m:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                                        매수적정가: {formatUSD(purchasePrice)}{' '}
                                        <span className={`${pctDiff(purchasePrice) !== null && Number(pctDiff(purchasePrice)) >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                                            {pctDiff(purchasePrice) !== null ? `(${Number(pctDiff(purchasePrice)) >= 0 ? '+' : ''}${pctDiff(purchasePrice)}%)` : ''}
                                        </span>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-emerald-700" />
                                    </div>
                                </div>
                            )}
                            {/* 목표매도가 마커 */}
                            {sellBarPct !== null && (
                                <div className="group/m absolute cursor-pointer" style={{ left: `${sellBarPct}%`, top: '-5px', bottom: '-5px', width: '10px', transform: 'translateX(-50%)', zIndex: 15 }}>
                                    <div className="absolute rounded-sm transition-all group-hover/m:scale-x-150 group-hover/m:opacity-100" style={{ left: '3px', right: '3px', top: 0, bottom: 0, background: '#3b82f6', boxShadow: '0 0 4px rgba(59,130,246,0.6)', opacity: 0.85 }} />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2.5 py-1.5 bg-blue-700 text-white text-[11px] font-medium rounded shadow-lg opacity-0 invisible group-hover/m:opacity-100 group-hover/m:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                                        목표매도가: {formatUSD(sellTarget)}{' '}
                                        <span className={`${pctDiff(sellTarget) !== null && Number(pctDiff(sellTarget)) >= 0 ? 'text-blue-200' : 'text-red-200'}`}>
                                            {pctDiff(sellTarget) !== null ? `(${Number(pctDiff(sellTarget)) >= 0 ? '+' : ''}${pctDiff(sellTarget)}%)` : ''}
                                        </span>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-700" />
                                    </div>
                                </div>
                            )}
                            {/* 현재가 마커 (점) */}
                            {currentPct !== null && (
                                <div className="group/m absolute cursor-pointer" style={{ left: `${currentPct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '18px', height: '18px', zIndex: 20, opacity: 0.85 }}>
                                    <div className="w-full h-full rounded-full bg-white border-2 border-slate-800 dark:border-white dark:bg-slate-800 shadow transition-all group-hover/m:scale-125 group-hover/m:opacity-100" />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-medium rounded shadow-lg opacity-0 invisible group-hover/m:opacity-100 group-hover/m:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                                        현재가: {formatUSD(price)}
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* 바 라벨 */}
                        <div className="flex justify-between mt-2.5 text-[10px] text-slate-400 dark:text-slate-500">
                            <span>손절매가</span>
                            <span>적정가</span>
                        </div>
                    </div>
                )}
            </div>

            {/* 그레이엄 등급 간단 배지 */}
            {(() => {
                const getVal = (obj, keys) => {
                    if (!obj || typeof obj !== 'object') return undefined;
                    for (const key of keys) { if (obj[key] != null) return obj[key]; }
                    const containers = ['상세', '상세정보', 'detail', 'details'];
                    for (const c of containers) {
                        if (obj[c] && typeof obj[c] === 'object') {
                            for (const key of keys) { if (obj[c][key] != null) return obj[c][key]; }
                        }
                    }
                    return undefined;
                };
                const grade = getVal(data, ['그레이엄_등급']);
                const passCount = getVal(data, ['그레이엄_통과수']);
                if (grade == null || grade === 'N/A') return null;
                const colorClass =
                    grade === '강력매수' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' :
                    grade === '매수' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    grade === '관망' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
                return (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">그레이엄:</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${colorClass}`}>
                            {grade} ({passCount ?? 0}/5)
                        </span>
                    </div>
                );
            })()}
        </div>
    );
};

/**
 * 고평가 경고 배너
 */
const OvervaluationBanner = ({ data }) => {
    const { price, target } = usePriceMetrics(data);
    const current = toNumber(price);
    const fair = toNumber(target);

    if (isNaN(current) || isNaN(fair) || fair <= 0 || current <= fair) return null;

    const overPct = ((current - fair) / fair * 100).toFixed(1);

    return (
        <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 flex items-center gap-2">
            <span className="text-xl leading-none">🔴</span>
            <div className="text-sm text-red-800 dark:text-red-200">
                현재가(<span className="font-semibold">${formatNumber(current, 2)}</span>)가 적정가(<span className="font-semibold">${formatNumber(fair, 2)}</span>)보다 <span className="font-bold text-red-600 dark:text-red-300">{overPct}%</span> 높음 — <span className="font-bold">고평가 주의</span>
            </div>
        </div>
    );
};

/**
 * 지표 카드
 */
const MetricCard = ({ label, value, valueClassName = '', subValue = null, subLabel = '' }) => (
    <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-slate-700 dark:border-slate-600">
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <div className={`mt-1 text-lg font-semibold ${valueClassName || 'dark:text-white'}`}>{value}</div>
        {subValue && (
            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                <span className="text-slate-500 dark:text-slate-400">{subLabel}: </span>
                <span className="font-medium text-slate-600 dark:text-slate-300">{subValue}</span>
            </div>
        )}
    </div>
);

/**
 * 데이터 그리드
 */
const DataGrid = ({ data, onOpenDetail, predictionData }) => (
    <div className="rounded-lg border bg-white p-3 dark:bg-slate-700 dark:border-slate-600">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
            {Object.entries(data).map(([key, value]) => (
                <DataRow
                    key={key}
                    label={key}
                    value={value}
                    onOpenDetail={onOpenDetail}
                    predictionData={predictionData}
                />
            ))}
        </div>
    </div>
);

/**
 * 데이터 행
 */
const DataRow = ({ label, value, onOpenDetail, predictionData }) => {
    // 예측데이터 필드인 경우 predictionData state 우선 사용
    const isPredictionField = label === '예측데이터' || label === 'predictionData' || label === 'prediction';
    const displayValue = isPredictionField && predictionData ? predictionData : value;

    return (
        <div className="flex items-start justify-between gap-3 border-b last:border-b-0 py-1 dark:border-slate-600">
            <div className="text-slate-500 whitespace-nowrap dark:text-slate-400">{label}</div>
            <div className="text-right break-all font-medium max-w-[60%] dark:text-slate-200">
                {renderValue(displayValue, label, onOpenDetail)}
            </div>
        </div>
    );
};

/**
 * 값 렌더링
 */
const renderValue = (value, label, onOpenDetail) => {
    if (Array.isArray(value)) {
        return (
            <details className="inline-block float-right text-right">
                <summary className="cursor-pointer text-slate-600 dark:text-slate-400">[{value.length}] 배열</summary>
                <pre className="mt-1 p-2 bg-slate-50 rounded text-xs whitespace-pre-wrap dark:bg-slate-800 dark:text-slate-300">
                    {JSON.stringify(value, null, 2)}
                </pre>
            </details>
        );
    }

    if (typeof value === 'object' && value !== null) {
        return (
            <button
                type="button"
                className="inline-block float-right text-slate-600 underline text-xs hover:text-indigo-600 transition-colors dark:text-slate-400 dark:hover:text-indigo-400"
                onClick={() => onOpenDetail(label, value)}
            >
                자세히 보기
            </button>
        );
    }

    if (typeof value === 'number') {
        return formatNumber(value, 4);
    }

    return value == null ? '-' : String(value);
};

/**
 * 액션 버튼들
 */
const ActionButtons = ({ data, onCopy, onClose, onOpenChart, onOpenInvestmentDetail, investmentLoading, fromInvestmentDetail = false }) => {
    // 심볼 추출
    const getValDeep = (obj, keys) => {
        if (!obj || typeof obj !== 'object') return undefined;
        for (const key of keys) {
            if (obj[key] != null) return obj[key];
        }
        return undefined;
    };
    const symbol = getValDeep(data, ['symbol', 'ticker', 'code', '주식코드', '주식심볼', '기업심볼']);

    const handleInvestmentJudgment = () => {
        if (symbol) {
            onOpenInvestmentDetail(symbol);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <div className="flex gap-2">
                <button
                    className="flex-1 sm:flex-none px-3 py-2 rounded-md border text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/30 whitespace-nowrap"
                    onClick={onOpenChart}
                    title="주식 가격 및 거래량 차트 보기"
                >
                    <ChartIcon />
                    차트 보기
                </button>
                {symbol && (
                    <button
                        className="flex-1 sm:flex-none px-3 py-2 rounded-md border text-sm hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1.5 text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        onClick={handleInvestmentJudgment}
                        disabled={investmentLoading || fromInvestmentDetail}
                        title={fromInvestmentDetail ? "이미 투자 판단 상세 모달에서 열렸습니다" : "투자 판단 상세 보기"}
                    >
                        {investmentLoading ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                조회 중...
                            </>
                        ) : (
                            <>
                                <AnalysisIcon />
                                투자 판단
                            </>
                        )}
                    </button>
                )}
            </div>
            <div className="flex gap-2">
                <button
                    className="flex-1 sm:flex-none px-3 py-2 rounded-md border text-sm hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    onClick={() => onCopy(data, 'JSON이 클립보드에 복사되었습니다.')}
                >
                    JSON 복사
                </button>
                <button
                    className="flex-1 sm:flex-none px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                    onClick={onClose}
                >
                    닫기
                </button>
            </div>
        </div>
    );
};

/**
 * 해석 가이드 오버레이
 */
const GuideOverlay = ({ onClose, data }) => {
    const metrics = useCompanyMetrics(data);
    const 매출기반평가 = metrics.매출기반평가;

    return (
        <>
            <div className="fixed inset-0 z-[120] bg-black/50 dark:bg-black/70" onClick={onClose} />
            <div
                className="fixed z-[130] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(720px,calc(100vw-24px))] max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:bg-slate-800 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-2.5 dark:bg-slate-800 dark:border-slate-700">
                    <div className="text-sm font-semibold text-slate-800 dark:text-white">📈 해석 요약</div>
                    <button
                        className="text-xs rounded border px-2 py-1 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        onClick={onClose}
                    >
                        닫기 (Esc)
                    </button>
                </div>

                <div className="px-4 pt-3 pb-4 text-[12px] text-slate-600 dark:text-slate-400">
                    {매출기반평가
                        ? 'PSR(↓: 저평가, ↑: 고평가)와 적정가(↑/↓) 조합으로 간단한 해석 매트릭스입니다.'
                        : 'PEG(↓: 저평가, ↑: 고평가)와 적정가(↑/↓) 조합으로 간단한 해석 매트릭스입니다.'
                    }
                </div>

                <div className="px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {매출기반평가 ? (
                            <>
                                <GuideCard
                                    color="emerald"
                                    title="적정가↑ / PSR↓"
                                    description="매출 대비 저평가 (투자유효)"
                                />
                                <GuideCard
                                    color="amber"
                                    title="적정가↑ / PSR↑"
                                    description="높은 기대 반영된 고평가 (관망)"
                                />
                                <GuideCard
                                    color="rose"
                                    title="적정가↓ / PSR↑"
                                    description="매출둔화 + 고평가 (주의)"
                                />
                                <GuideCard
                                    color="slate"
                                    title="적정가↓ / PSR↓"
                                    description="저평가지만 성장성 부족 (신중 검토)"
                                />
                            </>
                        ) : (
                            <>
                                <GuideCard
                                    color="emerald"
                                    title="적정가↑ / PEG↓"
                                    description="성장 대비 저평가 (투자유효)"
                                />
                                <GuideCard
                                    color="amber"
                                    title="적정가↑ / PEG↑"
                                    description="성장성 반영된 고평가 (관망)"
                                />
                                <GuideCard
                                    color="rose"
                                    title="적정가↓ / PEG↑"
                                    description="성장둔화 + 고평가 (주의)"
                                />
                                <GuideCard
                                    color="slate"
                                    title="적정가↓ / PEG↓"
                                    description="성장정체지만 밸류 낮음 (저PER 반등 가능)"
                                />
                            </>
                        )}
                    </div>

                    {/* 투자판정 (가치등급 × 타이밍) */}
                    <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
                        <div className="text-[12px] font-semibold text-blue-800 dark:text-blue-300 mb-1.5">
                            📋 투자판정 = 가치등급 × 타이밍
                        </div>
                        <div className="text-[11px] text-blue-700 dark:text-blue-400 space-y-1">
                            <div className="font-medium">가치등급: 1~5단계(펀더멘털 82점)를 100점 환산 — S≥92 / A≥83 / B≥73 / C≥63 / D≥50 / F</div>
                            <ul className="list-disc pl-4 space-y-0.5">
                                <li><span className="font-semibold">가치 S/A/B + 타이밍 양호</span> → 🔵 매수 후보</li>
                                <li><span className="font-semibold">가치 S/A/B + 타이밍 미흡(대기/하락/관망)</span> → 🟡 관심목록</li>
                                <li><span className="font-semibold">가치 C/D/F</span> → ⚪ 관망</li>
                            </ul>
                            <div>초소형주(&lt;$300M)·극단 괴리(±200%)는 매수 후보에서 관심목록으로 강등, 채권/이상치는 관망</div>
                        </div>
                    </div>

                    {/* 6단계 평가 항목 */}
                    <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
                        <div className="text-[12px] font-semibold text-blue-800 dark:text-blue-300 mb-1.5">
                            📋 6단계 평가 항목 (100점)
                        </div>
                        <div className="text-[11px] text-blue-700 dark:text-blue-400">
                            <ul className="list-disc pl-4 space-y-0.5">
                                <li>1단계: 위험 신호 확인 (12점) — 수익가치계산불가, 적자, 매출기반</li>
                                <li>2단계: 신뢰도 확인 (18점) — PER, 순부채, 영업이익 안정성</li>
                                <li>3단계: 밸류에이션 (20점) — PEG, 가격차이, 성장률</li>
                                <li>4단계: 영업이익 추세 (15점) — 3년간 추세, 성장률 크기</li>
                                <li>5단계: 투자 적합성 (17점) — 매수적정가(세분화), 그레이엄(강화)</li>
                                <li>6단계: 모멘텀 분석 (18점) — SMA50/200, RSI, 거래량 추세</li>
                            </ul>
                        </div>
                    </div>

                    {/* 엑셀 대량조회 색상 기준 */}
                    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-700/30">
                        <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 mb-2">
                            📊 엑셀 대량조회 색상 기준
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                            가치등급 기반 (1~5단계 펀더멘털, 타이밍 미반영)
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-start gap-2">
                                <span className="inline-block w-3 h-3 mt-0.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#FDE68A' }} />
                                <div>
                                    <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300">노란색 — 펀더멘털 최우수/우수</span>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        S 또는 A 등급
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="inline-block w-3 h-3 mt-0.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#BBF7D0' }} />
                                <div>
                                    <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300">초록색 — 펀더멘털 양호</span>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        B 등급
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="inline-block w-3 h-3 mt-0.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#E0F2FE' }} />
                                <div>
                                    <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300">하늘색 — 펀더멘털 보통</span>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        C 등급
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="inline-block w-3 h-3 mt-0.5 rounded-sm border border-slate-300 dark:border-slate-500 flex-shrink-0" />
                                <div>
                                    <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300">없음</span>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">D 또는 F 등급</div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                            우선순위: 노란색 {'>'} 초록색 {'>'} 하늘색 {'>'} 없음
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

/**
 * 가이드 카드
 */
const GuideCard = ({ color, title, description }) => {
    const colorStyles = {
        emerald: 'rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/30',
        amber: 'rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/30',
        rose: 'rounded-md border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-900/30',
        slate: 'rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/30'
    };

    const titleStyles = {
        emerald: 'mb-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400',
        amber: 'mb-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400',
        rose: 'mb-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400',
        slate: 'mb-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300'
    };

    const descStyles = {
        emerald: 'text-[12px] text-emerald-800 dark:text-emerald-300',
        amber: 'text-[12px] text-amber-800 dark:text-amber-300',
        rose: 'text-[12px] text-rose-800 dark:text-rose-300',
        slate: 'text-[12px] text-slate-800 dark:text-slate-200'
    };

    return (
        <div className={colorStyles[color]}>
            <div className={titleStyles[color]}>{title}</div>
            <div className={descStyles[color]}>{description}</div>
        </div>
    );
};

/**
 * 상세보기 오버레이
 */
const DetailOverlay = ({ title, data, onClose, onCopy }) => (
    <>
        <div className="fixed inset-0 z-[120] bg-black/50 dark:bg-black/70" onClick={onClose} />
        <div
            className="fixed z-[130] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(900px,calc(100vw-24px))] max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:bg-slate-800 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-2.5 dark:bg-slate-800 dark:border-slate-700">
                <div className="text-sm font-semibold text-slate-800 dark:text-white">🔎 {title || '상세보기'}</div>
                <div className="flex items-center gap-2">
                    <button
                        className="text-xs rounded border px-2 py-1 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        onClick={() => onCopy(data, '상세 JSON이 복사되었습니다.')}
                    >
                        JSON 복사
                    </button>
                    <button
                        className="text-xs rounded border px-2 py-1 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        onClick={onClose}
                    >
                        닫기 (Esc)
                    </button>
                </div>
            </div>

            <div className="p-3">
                {data && typeof data === 'object' ? (
                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                        {Object.entries(data).map(([key, value]) => (
                            <DetailCard key={key} label={key} value={value} />
                        ))}
                    </div>
                ) : (
                    <pre className="text-xs dark:text-slate-300">{String(data)}</pre>
                )}
            </div>
        </div>
    </>
);

/**
 * 상세 카드
 */
const DetailCard = ({ label, value }) => (
    <div className="rounded border border-slate-200 bg-white px-2.5 py-2 dark:bg-slate-700 dark:border-slate-600">
        <div className="text-[11px] text-slate-500 mb-1 truncate dark:text-slate-400" title={label}>
            {label}
        </div>
        <div className="text-[12px] font-mono tabular-nums break-words whitespace-pre-wrap dark:text-slate-200">
            {formatDetailValue(value)}
        </div>
    </div>
);

/**
 * Info 아이콘
 */
const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-.75 6a.75.75 0 0 1 1.5 0v.008a.75.75 0 0 1-1.5 0V8.25Zm0 3a.75.75 0 0 1 1.5 0v5.25a.75.75 0 0 1-1.5 0V11.25Z" clipRule="evenodd" />
    </svg>
);

/**
 * Chart 아이콘
 */
const ChartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z" />
    </svg>
);

/**
 * Analysis 아이콘
 */
const AnalysisIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd" />
    </svg>
);

// ============ Custom Hooks ============

/**
 * 기업 지표 계산 Hook
 * 투자판정: 가치등급 × 타이밍 (오늘의 매수후보/투자판단 화면과 동일 필드)
 */
const useCompanyMetrics = (data, evaluationData) => {
    return useMemo(() => {
        const getValDeep = (obj, keys) => {
            if (!obj || typeof obj !== 'object') return undefined;

            for (const key of keys) {
                if (obj[key] != null) return obj[key];
            }

            const containers = ['상세', '상세정보', 'detail', 'details', 'metric', 'metrics', 'valuation', 'summary', 'data'];
            for (const container of containers) {
                if (obj[container] && typeof obj[container] === 'object') {
                    const found = getValDeep(obj[container], keys);
                    if (found !== undefined) return found;
                }
            }

            return undefined;
        };

        const toNum = (v) => {
            if (v == null) return NaN;
            if (typeof v === 'number') return v;
            if (typeof v === 'string') {
                const cleaned = v.replace(/[,%\s]/g, '');
                const num = Number(cleaned);
                return Number.isNaN(num) ? NaN : num;
            }
            return NaN;
        };

        const symbol = getValDeep(data, ['symbol', 'ticker', 'code', '주식코드', '주식심볼', '기업심볼']);
        const name = getValDeep(data, ['companyName', 'name', 'company', '기업명']);
        const per = getValDeep(data, ['per', 'PER', 'pe', 'peRatio', 'perTTM', 'PER(TTM)']);
        const perAdj = getValDeep(data, ['성장률보정PER', 'growthAdjustedPER', 'perGrowthAdjusted']);
        const pegBackend = getValDeep(data, ['PEG', 'peg', 'pegRatio', 'pegTTM', '성장률보정PEG']);
        const psr = getValDeep(data, ['psr', 'PSR', 'priceToSales', 'psRatio']);
        const eps = getValDeep(data, ['epsTtm', 'epsTTM', 'eps', 'EPS', 'EPS(TTM)']);

        const perNum = toNum(per);
        const pegBackendNum = toNum(pegBackend);

        const growthRaw = getValDeep(data, [
            'growthRate', '이익성장률', 'growth', 'growthPct', 'growthPercent', 'growthPercentage',
            'epsGrowth', 'epsGrowthRate', 'earningsGrowth', 'ttmEpsGrowth', 'forwardEarningsGrowth',
            'nextYearGrowth', 'profitGrowth', 'netIncomeGrowth'
        ]);
        const gNum = toNum(growthRaw);
        const growthPct = Number.isNaN(gNum) ? NaN : Math.abs(gNum > 1 ? gNum : gNum * 100);
        const pegCalc = (!Number.isNaN(perNum) && !Number.isNaN(growthPct) && growthPct !== 0)
            ? perNum / growthPct
            : NaN;

        const pegToShow = !Number.isNaN(pegBackendNum) ? pegBackendNum : pegCalc;
        const perAdjNum = toNum(perAdj);
        const psrNum = toNum(psr);

        // 매출기반평가 플래그 확인
        const 매출기반평가 = getValDeep(data, ['매출기반평가', 'revenueBased', 'isRevenueBased']) === true;

        const grahamGrade = getValDeep(data, ['그레이엄_등급']);

        // 투자판정 (가치등급 × 타이밍) — 레거시 grade/totalScore(게이트 적용)는 사용 안 함
        const valueGrade = evaluationData?.valueGrade;
        const valueScore = evaluationData?.valueScore;
        const timingSignal = evaluationData?.timingSignal;
        const investmentSignal = evaluationData?.investmentSignal;

        return {
            symbol,
            name,
            per: Number.isNaN(perNum) ? null : perNum,
            perAdj: Number.isNaN(perAdjNum) ? null : perAdjNum,
            peg: Number.isFinite(pegToShow) ? pegToShow : null,
            psr: Number.isNaN(psrNum) ? null : psrNum,
            eps: Number.isNaN(toNum(eps)) ? null : toNum(eps),
            매출기반평가,
            grahamGrade,
            valueGrade: valueGrade || null,
            valueScore: valueScore ?? null,
            timingSignal: timingSignal || null,
            investmentSignal: investmentSignal || null,
        };
    }, [data, evaluationData]);
};

/**
 * 가격 지표 계산 Hook
 */
const usePriceMetrics = (data) => {
    return useMemo(() => {
        const getValDeep = (obj, keys) => {
            if (!obj || typeof obj !== 'object') return undefined;

            // 먼저 현재 레벨에서 검색
            for (const key of keys) {
                if (obj[key] != null) return obj[key];
            }

            // 상세정보 등 중첩 객체에서 검색
            const containers = ['상세', '상세정보', 'detail', 'details', 'resultDetail', 'metric', 'metrics', 'valuation', 'summary', 'data'];
            for (const container of containers) {
                if (obj[container] && typeof obj[container] === 'object') {
                    for (const key of keys) {
                        if (obj[container][key] != null) return obj[container][key];
                    }
                }
            }

            return undefined;
        };

        const toNum = (v) => {
            if (v == null) return NaN;
            if (typeof v === 'number') return v;
            if (typeof v === 'string') {
                const cleaned = v.replace(/[,%\s]/g, '');
                return Number(cleaned);
            }
            return NaN;
        };

        const price = getValDeep(data, ['currentPrice', 'price', 'close', '현재가격', '현재가', '종가']);
        const target = getValDeep(data, ['fairValue', 'perValue', 'estimatedValue', 'targetPrice', '적정가', '주당가치', '적정가(추정)']);
        const calculatedTarget = getValDeep(data, ['계산된주당가치', 'calculatedPerShareValue', 'calculatedFairValue']);
        const purchasePrice = getValDeep(data, ['매수적정가', 'purchasePrice']);
        const sellTarget = getValDeep(data, ['목표매도가', 'sellTarget']);
        const stopLossPrice = getValDeep(data, ['손절매가', 'stopLossPrice']);

        const priceNum = toNum(price);
        const targetNum = toNum(target);
        const calculatedTargetNum = toNum(calculatedTarget);
        const upside = (!Number.isNaN(priceNum) && !Number.isNaN(targetNum))
            ? (targetNum / priceNum - 1)
            : null;

        return {
            price,
            target,
            calculatedTarget: Number.isNaN(calculatedTargetNum) ? null : calculatedTargetNum,
            purchasePrice,
            sellTarget,
            stopLossPrice,
            upside
        };
    }, [data]);
};

// ============ Utility Functions ============

const toNumber = (v) => {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        const s = v.replace(/[,%\s]/g, '');
        return Number(s);
    }
    return NaN;
};

const formatNumber = (v, digits = 2) => {
    const n = toNumber(v);
    if (Number.isNaN(n)) return '-';
    try {
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
    } catch {
        return String(v);
    }
};

const formatUSD = (v, digits = 2) => (v == null ? '-' : `$${formatNumber(v, digits)}`);

const formatPercent = (ratio, digits = 1) => {
    const n = toNumber(ratio);
    return Number.isNaN(n) ? '-' : `${(n * 100).toFixed(digits)}%`;
};

const formatDetailValue = (value) => {
    if (Array.isArray(value)) {
        return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'number') {
        return formatNumber(value, 4);
    }
    return value == null ? '-' : String(value);
};

export default CompanyValueResultModal;