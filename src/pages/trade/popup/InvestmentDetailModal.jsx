import { useState, useRef, useEffect } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';
import CompanyInfoModal from '@/pages/trade/popup/CompanyInfoModal';
import StockChartModal from '@/pages/trade/popup/StockChartModal';
import CompanyValueResultModal from '@/pages/trade/popup/CompanyValueResultModal';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import { send, API_ENDPOINTS } from '@/util/ClientUtil';

// 숫자를 천 단위 콤마 포맷으로 변환
const formatNumberWithComma = (value) => {
    if (value === null || value === '' || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    return num.toLocaleString('en-US');
};

// 등급별 색상
const getGradeStyle = (grade) => {
    const styles = {
        'S': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
        'A': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
        'B': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        'C': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        'D': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
        'F': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return styles[grade] || 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
};

// 투자판정 아이콘 (색각이상 친화: 파랑/노랑/회색) — DailyPicks와 동일
const SIGNAL_ICON = { '매수 후보': '🔵', '관심목록': '🟡', '관망': '⚪' };

// 소수점 1자리로 표시할 점수 필드
const SCORE_FIELDS = new Set(['valueScore', 'totalScore']);

// 필드 레이블 매핑 (영문 -> 한글)
const FIELD_LABELS = {
    symbol: '심볼',
    companyName: '기업명',
    investmentSignal: '투자판정',
    valueGrade: '가치등급',
    valueScore: '가치점수',
    timingSignal: '타이밍',
    timingScore: '타이밍 점수',
    currentPrice: '현재가',
    fairValue: '적정가치',
    calFairValue: '계산된 주당가치',
    priceDifference: '가격차이',
    priceGapPercent: '가격차이율',
    totalScore: '종합점수(레거시)',
    grade: '종합등급(레거시)',
    recommendation: '추천(종합점수 기준)',
    purchasePrice: '매수적정가',
    sellTarget: '목표매도가',
    stopLossPrice: '손절매가',
    peg: 'PEG',
    per: 'PER',
    sector: '섹터',
    industry: '산업군',
    beta: '베타',
    exchange: '거래소',
    country: '국가',
    marketCap: '시가총액',
    step1Score: '1단계 점수',
    step2Score: '2단계 점수',
    step3Score: '3단계 점수',
    step4Score: '4단계 점수',
    step5Score: '5단계 점수',
    step6Score: '6단계 점수',
};

// resultDetail 필드 레이블 매핑
const RESULT_DETAIL_LABELS = {
    '단위': '단위',
    '영업이익_전전기': '영업이익 (전전기)',
    '영업이익_전기': '영업이익 (전기)',
    '영업이익_당기': '영업이익 (당기)',
    '영업이익_합계': '영업이익 합계',
    '영업이익_평균': '영업이익 평균',
    '유동자산합계': '유동자산 합계',
    '유동부채합계': '유동부채 합계',
    '유동비율': '유동비율',
    '투자자산_비유동자산내': '투자자산 (비유동자산내)',
    '고정부채': '고정부채',
    '발행주식수': '발행주식수',
    '영업이익성장률': '영업이익 성장률',
    '성장률보정PER': '성장률 보정 PER',
    '무형자산': '무형자산',
    '연구개발비_당기': '연구개발비 (당기)',
    '연구개발비_전기': '연구개발비 (전기)',
    '연구개발비_전전기': '연구개발비 (전전기)',
    '연구개발비_평균': '연구개발비 평균',
    '총부채': '총부채',
    '현금성자산': '현금성자산',
    '순부채': '순부채',
    '계산_사업가치': '계산 - 사업가치',
    '계산_재산가치': '계산 - 재산가치',
    '계산_부채': '계산 - 부채',
    '계산_기업가치': '계산 - 기업가치',
    '예외메세지_영업이익': '예외메세지 (영업이익)',
    '예외메시지_발행주식수': '예외메세지 (발행주식수)',
    '수익가치계산불가': '수익가치 계산불가',
    '적자기업': '적자기업',
    '매출기반평가': '매출기반 평가',
    '흑자전환기업': '흑자전환 기업',
    '매출액': '매출액',
    '매출성장률': '매출 성장률',
    '매출성장률보정계수': '매출성장률 보정계수',
    'eps성장률': 'EPS 성장률',
    'per': 'PER',
    'peg': 'PEG',
    'psr': 'PSR',
    'calFairValue': '계산된 주당가치',
    '급락종목할인': '급락종목 할인',
    '분기적자전환': '분기 적자전환',
    'PBR': 'PBR',
    '그레이엄_PER통과': '그레이엄 PER',
    '그레이엄_PBR통과': '그레이엄 PBR',
    '그레이엄_복합통과': '그레이엄 PER×PBR',
    '그레이엄_유동비율통과': '그레이엄 유동비율',
    '그레이엄_연속흑자통과': '그레이엄 연속흑자',
    '그레이엄_통과수': '그레이엄 통과수',
    '그레이엄_등급': '그레이엄 등급',
};

// resultDetail 값 포맷팅
const formatResultDetailValue = (key, value) => {
    if (value === null || value === undefined || value === '' || value === 'N/A') return '-';

    // boolean 값
    if (typeof value === 'boolean') {
        return value ? '예' : '아니오';
    }

    // 비율 값
    if (key.includes('성장률') || key.includes('비율') || key === 'peg' || key === 'per' || key === 'psr') {
        const num = parseFloat(value);
        if (!isNaN(num)) {
            if (key.includes('성장률')) {
                return `${(num * 100).toFixed(2)}%`;
            }
            return num.toFixed(4);
        }
    }

    // 큰 숫자 포맷
    const num = parseFloat(value);
    if (!isNaN(num) && num > 1000000) {
        return formatNumberWithComma(num);
    }

    return String(value);
};

/**
 * 하이라이트 카드 컴포넌트
 */
const HighlightCard = ({ label, value, isGrade, onClick, clickable, subValue = null, subLabel = '', valueSuffix = null }) => {
    const CardWrapper = clickable ? 'button' : 'div';
    return (
        <CardWrapper
            type={clickable ? 'button' : undefined}
            onClick={clickable ? onClick : undefined}
            className={`rounded-lg border bg-white p-3 shadow-sm dark:bg-slate-700 dark:border-slate-600 group relative text-left w-full ${clickable
                ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/30 dark:hover:border-blue-600 transition-colors ring-0 hover:ring-2 hover:ring-blue-200 dark:hover:ring-blue-800'
                : ''
                }`}
        >
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                {label}
                {clickable && (
                    <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3m0 0l3 3m-3-3v8m0-14a9 9 0 110 18 9 9 0 010-18z" />
                    </svg>
                )}
            </div>
            <div className={`mt-1 text-base font-semibold text-slate-900 dark:text-white truncate ${clickable ? 'group-hover:text-blue-600 dark:group-hover:text-blue-400' : ''}`}>
                {isGrade ? (
                    <span className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-bold ${getGradeStyle(value)}`}>
                            {value || '-'}
                        </span>
                        {valueSuffix && <span className="text-sm">{valueSuffix}</span>}
                    </span>
                ) : (
                    <span className="flex items-center gap-1">
                        {value}
                        {clickable && (
                            <svg className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        )}
                    </span>
                )}
            </div>
            {/* 서브값 표시 */}
            {subValue && (
                <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    <span className="text-slate-500 dark:text-slate-400">{subLabel}: </span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">{subValue}</span>
                </div>
            )}
            {/* 툴팁 */}
            {value && String(value).length > 15 && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 max-w-xs whitespace-normal break-all pointer-events-none">
                    {value}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                </div>
            )}
        </CardWrapper>
    );
};

/**
 * 정보 카드 컴포넌트
 */
const InfoCard = ({ label, value }) => (
    <div className="rounded-lg border bg-slate-50 p-2.5 dark:bg-slate-700 dark:border-slate-600 group relative">
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <div className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{value}</div>
        {/* 툴팁 */}
        {value && String(value).length > 20 && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 max-w-xs whitespace-normal break-all pointer-events-none">
                {value}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
            </div>
        )}
    </div>
);

/**
 * 단계별 상세 카드 컴포넌트
 */
const StepDetailCard = ({ step }) => {
    const progressPercent = (step.score / step.maxScore) * 100;

    return (
        <div className="rounded-lg border bg-white p-3 shadow-sm dark:bg-slate-700 dark:border-slate-600">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold dark:bg-slate-600 dark:text-slate-200">
                        {step.stepNumber}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{step.stepName}</span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {step.score} / {step.maxScore}
                </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2 dark:bg-slate-600">
                <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                ></div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{step.description}</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{step.details}</p>
        </div>
    );
};

/**
 * 시그널 배지 색상
 */
const getSignalBadgeStyle = (color) => {
    const styles = {
        green: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700',
        yellow: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700',
        red: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-200 dark:border-red-700',
        gray: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
    };
    return styles[color] || styles.gray;
};

const getSignalIcon = (color) => {
    const icons = { green: '\u{1F7E2}', yellow: '\u{1F7E1}', red: '\u{1F534}', gray: '\u26AA' };
    return icons[color] || icons.gray;
};

/**
 * 진입 타이밍 분석 섹션
 */
const EntryTimingSection = ({ entryTiming }) => {
    const [showDetail, setShowDetail] = useState(false);

    if (!entryTiming) return null;

    return (
        <div className="mb-4 rounded-lg border bg-white shadow-sm dark:bg-slate-700 dark:border-slate-600">
            <div className="p-4">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">진입 타이밍 분석</div>

                {/* 시그널 + 점수 */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border whitespace-nowrap ${getSignalBadgeStyle(entryTiming.signalColor)}`}>
                        <span>{getSignalIcon(entryTiming.signalColor)}</span>
                        {entryTiming.signal}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        타이밍 점수: <span className="font-bold">{entryTiming.timingScore}</span><span className="text-slate-400">/100</span>
                    </span>
                </div>

                {/* 단기추세 + MACD */}
                <div className="space-y-1.5 mb-3 text-sm text-slate-700 dark:text-slate-300">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">단기추세:</span>
                        <span className={`font-medium whitespace-nowrap ${
                            entryTiming.shortTermTrend === '상승' ? 'text-emerald-600 dark:text-emerald-400' :
                            entryTiming.shortTermTrend === '하락' ? 'text-red-600 dark:text-red-400' :
                            'text-slate-600 dark:text-slate-300'
                        }`}>{entryTiming.shortTermTrend}</span>
                        {entryTiming.trendDetail && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">({entryTiming.trendDetail})</span>
                        )}
                    </div>
                </div>

                {/* 예상 지지/저항 */}
                {(entryTiming.estimatedSupport > 0 || entryTiming.estimatedResistance > 0) && (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 text-sm">
                        <div className="whitespace-nowrap">
                            <span className="text-slate-500 dark:text-slate-400">예상 지지선: </span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">${entryTiming.estimatedSupport?.toFixed(2)}</span>
                        </div>
                        <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
                        <div className="whitespace-nowrap">
                            <span className="text-slate-500 dark:text-slate-400">예상 저항선: </span>
                            <span className="font-semibold text-red-600 dark:text-red-400">${entryTiming.estimatedResistance?.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* 상세 보기 토글 */}
                <button
                    type="button"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                    onClick={() => setShowDetail(!showDetail)}
                >
                    {showDetail ? '상세 접기' : '지표 상세 보기'}
                    <svg className={`w-3 h-3 transition-transform ${showDetail ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* 상세 지표 (접기/펼치기) */}
                {showDetail && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border dark:border-slate-600">
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">SMA5: </span>
                            <span className="font-medium dark:text-slate-200">${entryTiming.sma5?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">SMA20: </span>
                            <span className="font-medium dark:text-slate-200">${entryTiming.sma20?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">MACD: </span>
                            <span className="font-medium dark:text-slate-200">{entryTiming.macdLine?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">Signal: </span>
                            <span className="font-medium dark:text-slate-200">{entryTiming.macdSignal?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">Histogram: </span>
                            <span className={`font-medium ${entryTiming.macdHistogram >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {entryTiming.macdHistogram?.toFixed(2)}
                            </span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">Stoch %K: </span>
                            <span className="font-medium dark:text-slate-200">{entryTiming.stochasticK?.toFixed(1)}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">Stoch %D: </span>
                            <span className="font-medium dark:text-slate-200">{entryTiming.stochasticD?.toFixed(1)}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">ATR: </span>
                            <span className="font-medium dark:text-slate-200">${entryTiming.atr?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">볼린저 상단: </span>
                            <span className="font-medium dark:text-slate-200">${entryTiming.bollingerUpper?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">볼린저 중단: </span>
                            <span className="font-medium dark:text-slate-200">${entryTiming.bollingerMiddle?.toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                            <span className="text-slate-500 dark:text-slate-400">볼린저 하단: </span>
                            <span className="font-medium dark:text-slate-200">${entryTiming.bollingerLower?.toFixed(2)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * 트레이딩 가이드 섹션
 */
const TradingGuideSection = ({ data }) => {
    const currentPrice = parseFloat(data.currentPrice);

    const getVal = (...keys) => {
        for (const key of keys) {
            const v = data[key] ?? data.resultDetail?.[key];
            if (v != null && v !== '') {
                const n = parseFloat(v);
                if (!isNaN(n)) return n;
            }
        }
        return NaN;
    };

    const stopLoss = getVal('stopLossPrice', '손절매가');
    const purchasePrice = getVal('purchasePrice', '매수적정가');
    const sellTarget = getVal('sellTarget', '목표매도가');

    // 진입 타이밍에서 지지/저항선
    const estimatedSupport = data.entryTiming?.estimatedSupport || NaN;
    const estimatedResistance = data.entryTiming?.estimatedResistance || NaN;

    // 유효한 가격이 하나도 없으면 표시하지 않음
    if (isNaN(currentPrice) || (isNaN(stopLoss) && isNaN(purchasePrice) && isNaN(sellTarget))) return null;

    const formatUSD = (v) => isNaN(v) ? '-' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pctDiff = (v) => {
        if (isNaN(v) || isNaN(currentPrice) || currentPrice === 0) return null;
        return ((v - currentPrice) / currentPrice * 100).toFixed(1);
    };

    const guideItems = [
        { label: '손절매가', value: stopLoss, color: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
        { label: '매수적정가', value: purchasePrice, color: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
        { label: '목표매도가', value: sellTarget, color: 'text-blue-600 dark:text-blue-400', dotColor: 'bg-blue-500' },
    ].filter(item => !isNaN(item.value));

    const supportResistanceItems = [
        { label: '예상 지지선', value: estimatedSupport, color: 'text-teal-600 dark:text-teal-400', dotColor: 'bg-teal-500' },
        { label: '예상 저항선', value: estimatedResistance, color: 'text-orange-600 dark:text-orange-400', dotColor: 'bg-orange-500' },
    ].filter(item => !isNaN(item.value) && item.value > 0);

    // 프로그레스 바 계산 (지지/저항선도 범위에 포함)
    const barMinBase = isNaN(stopLoss) ? currentPrice * 0.85 : stopLoss;
    const fairValue = parseFloat(data.fairValue);
    const barMaxBase = !isNaN(fairValue) ? fairValue : (!isNaN(sellTarget) ? sellTarget : currentPrice * 1.15);
    const barMinRaw = Math.min(barMinBase, ...([estimatedSupport, estimatedResistance].filter(v => !isNaN(v) && v > 0)));
    const barMaxRaw = Math.max(barMaxBase, ...([estimatedSupport, estimatedResistance].filter(v => !isNaN(v) && v > 0)));
    const barPadding = (barMaxRaw - barMinRaw) * 0.03;
    const barMin = barMinRaw - barPadding;
    const barMax = barMaxRaw + barPadding;
    const barRange = barMax - barMin;
    const toBarPct = (v) => {
        if (isNaN(v) || barRange <= 0) return null;
        return Math.max(0, Math.min(100, ((v - barMin) / barRange) * 100));
    };
    const currentPct = toBarPct(currentPrice);
    const purchaseBarPct = toBarPct(purchasePrice);
    const sellBarPct = toBarPct(sellTarget);
    const supportBarPct = toBarPct(estimatedSupport);
    const resistanceBarPct = toBarPct(estimatedResistance);
    const hasBar = currentPct !== null;

    // 마커는 반투명 처리하여 겹쳐도 양쪽 다 보이게 함

    return (
        <div className="mb-4 rounded-lg border bg-white shadow-sm dark:bg-slate-700 dark:border-slate-600">
            <div className="p-4">
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

                {/* 예상 지지/저항선 */}
                {supportResistanceItems.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-600 space-y-2">
                        {supportResistanceItems.map(({ label, value, color, dotColor }) => {
                            const diff = pctDiff(value);
                            return (
                                <div key={label} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
                                        <span className="text-slate-600 dark:text-slate-300">{label}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">(볼린저)</span>
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
                )}

                {/* 프로그레스 바 */}
                {hasBar && (
                    <div className="mt-6 mb-2">
                        <div className="relative h-2.5 rounded-full bg-slate-200 dark:bg-slate-600">
                            <div
                                className="absolute inset-0 rounded-full"
                                style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)' }}
                            />
                            {/* 예상 지지선 마커 (◆ 다이아몬드) */}
                            {supportBarPct !== null && (
                                <div className="group/s absolute cursor-pointer" style={{ left: `${supportBarPct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '16px', height: '16px', zIndex: 12 }}>
                                    <div className="absolute inset-0.5 transition-all group-hover/s:scale-125 group-hover/s:opacity-100" style={{ background: '#2dd4bf', transform: 'rotate(45deg)', boxShadow: '0 0 5px rgba(45,212,191,0.6)', border: '1.5px solid rgba(255,255,255,0.5)', opacity: 0.85 }} />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2.5 py-1.5 bg-teal-700 text-white text-[11px] font-medium rounded shadow-lg opacity-0 invisible group-hover/s:opacity-100 group-hover/s:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                                        예상 지지선: {formatUSD(estimatedSupport)}{' '}
                                        <span className={`${pctDiff(estimatedSupport) !== null && Number(pctDiff(estimatedSupport)) >= 0 ? 'text-teal-200' : 'text-red-200'}`}>
                                            {pctDiff(estimatedSupport) !== null ? `(${Number(pctDiff(estimatedSupport)) >= 0 ? '+' : ''}${pctDiff(estimatedSupport)}%)` : ''}
                                        </span>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-teal-700" />
                                    </div>
                                </div>
                            )}
                            {/* 예상 저항선 마커 (◆ 다이아몬드) */}
                            {resistanceBarPct !== null && (
                                <div className="group/r absolute cursor-pointer" style={{ left: `${resistanceBarPct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '16px', height: '16px', zIndex: 13 }}>
                                    <div className="absolute inset-0.5 transition-all group-hover/r:scale-125 group-hover/r:opacity-100" style={{ background: '#fb923c', transform: 'rotate(45deg)', boxShadow: '0 0 5px rgba(251,146,60,0.6)', border: '1.5px solid rgba(255,255,255,0.5)', opacity: 0.85 }} />
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2.5 py-1.5 bg-orange-700 text-white text-[11px] font-medium rounded shadow-lg opacity-0 invisible group-hover/r:opacity-100 group-hover/r:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                                        예상 저항선: {formatUSD(estimatedResistance)}{' '}
                                        <span className={`${pctDiff(estimatedResistance) !== null && Number(pctDiff(estimatedResistance)) >= 0 ? 'text-orange-200' : 'text-red-200'}`}>
                                            {pctDiff(estimatedResistance) !== null ? `(${Number(pctDiff(estimatedResistance)) >= 0 ? '+' : ''}${pctDiff(estimatedResistance)}%)` : ''}
                                        </span>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-orange-700" />
                                    </div>
                                </div>
                            )}
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
                            {/* 현재가 마커 */}
                            <div className="group/m absolute cursor-pointer" style={{ left: `${currentPct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '18px', height: '18px', zIndex: 20, opacity: 0.85 }}>
                                <div className="w-full h-full rounded-full bg-white border-2 border-slate-800 dark:border-white dark:bg-slate-800 shadow transition-all group-hover/m:scale-125 group-hover/m:opacity-100" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-2.5 py-1.5 bg-slate-800 text-white text-[11px] font-medium rounded shadow-lg opacity-0 invisible group-hover/m:opacity-100 group-hover/m:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                                    현재가: {formatUSD(currentPrice)}
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between mt-2.5 text-[10px] text-slate-400 dark:text-slate-500">
                            <span>손절매가</span>
                            <span>적정가</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * 최근 뉴스 섹션 (아코디언, lazy fetch)
 */
const StockNewsSection = ({ symbol }) => {
    const [open, setOpen] = useState(false);
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchedSymbol, setFetchedSymbol] = useState(null);

    // symbol이 바뀌면 state 리셋
    useEffect(() => {
        setNews([]);
        setFetchedSymbol(null);
        setOpen(false);
        setLoading(false);
    }, [symbol]);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const { data, error } = await send('/dart/abroad/company/financial/fmp/stockNews', { tickers: symbol, limit: 7 }, 'POST');
            if (!error && data?.success && Array.isArray(data.response)) {
                setNews(data.response);
            }
        } catch (e) {
            // 뉴스 로드 실패 — 무시
        } finally {
            setLoading(false);
            setFetchedSymbol(symbol);
        }
    };

    const handleToggle = async () => {
        const next = !open;
        setOpen(next);
        if (next && fetchedSymbol !== symbol) {
            await fetchNews();
        }
    };

    const formatRelativeTime = (dateStr) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}분 전`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}시간 전`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}일 전`;
        return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    };

    if (!symbol) return null;

    return (
        <div className="mb-4 rounded-lg border bg-white shadow-sm dark:bg-slate-700 dark:border-slate-600">
            <button
                type="button"
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-600/50 transition-colors rounded-lg"
                onClick={handleToggle}
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">최근 뉴스</span>
                    {fetchedSymbol && news.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-medium">
                            {news.length}
                        </span>
                    )}
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="px-4 pb-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-6 text-sm text-slate-400">
                            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            뉴스를 불러오는 중...
                        </div>
                    ) : news.length === 0 ? (
                        <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500">
                            최근 뉴스가 없습니다
                        </div>
                    ) : (
                        <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-600">
                            {news.map((article, idx) => (
                                <a
                                    key={idx}
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block py-3 first:pt-0 hover:bg-slate-50 dark:hover:bg-slate-600/30 -mx-1 px-1 rounded transition-colors group"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h5 className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {article.title}
                                        </h5>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0 pt-0.5">
                                            {formatRelativeTime(article.publishedDate)}
                                        </span>
                                    </div>
                                    {article.text && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-1">
                                            {article.text}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                                        <span>{article.site}</span>
                                        <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * 투자 판단 상세 모달 컴포넌트
 */
const InvestmentDetailModal = ({ isOpen, data, onClose, onOpenFullDetail, zIndex = 50, fromCompanyValue = false }) => {

    const modalRef = useRef(null);
    const [companyInfoModal, setCompanyInfoModal] = useState({ open: false, symbol: null });
    const [chartModal, setChartModal] = useState({ open: false, symbol: null, companyName: null });
    const [companyValueModal, setCompanyValueModal] = useState({ open: false, data: null });
    const [companyValueLoading, setCompanyValueLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });

    // AlertModal 헬퍼 함수
    const openAlert = (message, onConfirm) => {
        setAlertConfig({ open: true, message, onConfirm: onConfirm || null });
    };

    const handleCloseAlert = () => {
        const { onConfirm } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null });
        if (onConfirm) onConfirm();
    };

    // ESC 키 핸들러
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    if (!shouldRender || !data) return null;

    const stepDetails = data.stepDetails || [];

    // 기업 정보 모달 열기
    const handleOpenCompanyInfo = () => {
        setCompanyInfoModal({ open: true, symbol: data.symbol });
    };

    // 차트 모달 열기
    const handleOpenChart = () => {
        setChartModal({ open: true, symbol: data.symbol, companyName: data.companyName });
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
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setCompanyValueLoading(false);
        }
    };

    return (
        <>
            {/* 배경 오버레이 */}
            <div
                className={`fixed inset-0 bg-black/50 dark:bg-black/70 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
                style={{ zIndex: zIndex - 10, animationDuration: '0.25s' }}
                onClick={onClose}
            />

            {/* 모달 */}
            <div
                ref={modalRef}
                className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-xl rounded-lg max-h-[85vh] w-[min(800px,90vw)] overflow-hidden dark:bg-slate-800 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`}
                style={{ zIndex, animationDuration: '0.25s' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="sticky top-0 px-4 py-3 border-b bg-white z-10 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <h2 className="text-lg font-semibold dark:text-white">투자 판단 상세</h2>
                            <button
                                type="button"
                                onClick={handleOpenCompanyInfo}
                                className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer transition-colors flex items-center gap-1 truncate max-w-full"
                            >
                                <span className="truncate">{data.symbol} - {data.companyName}</span>
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                                계산 버전: {data.calVersion}
                            </span>
                            <button
                                type="button"
                                className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed dark:disabled:bg-slate-600 flex items-center gap-1.5"
                                onClick={handleOpenCompanyValue}
                                disabled={companyValueLoading || fromCompanyValue}
                                title={fromCompanyValue ? "이미 기업가치 계산 결과 모달에서 열렸습니다" : "기업가치 계산 결과 보기"}
                            >
                                {companyValueLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="hidden sm:inline">조회 중...</span>
                                    </>
                                ) : (
                                    '기업 분석'
                                )}
                            </button>
                            {onOpenFullDetail && (
                                <button
                                    type="button"
                                    className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                                    onClick={() => onOpenFullDetail(data)}
                                >
                                    자세히 보기
                                </button>
                            )}
                            <button
                                className="whitespace-nowrap text-sm px-2 py-1 border rounded hover:bg-gray-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                onClick={onClose}
                            >
                                <span className="sm:hidden">닫기</span>
                                <span className="hidden sm:inline">닫기 (Esc)</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 콘텐츠 */}
                <div className="p-4 overflow-y-auto overflow-x-hidden max-h-[calc(85vh-60px)]">
                    {/* 요약 정보 */}
                    {/* 가치등급/투자판정은 오늘의 매수후보·투자판단 표와 동일 기준, 레거시 종합점수는 보조 표시 */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                        <HighlightCard
                            label="투자판정"
                            value={data.investmentSignal ? `${SIGNAL_ICON[data.investmentSignal] || ''} ${data.investmentSignal}` : '-'}
                        />
                        <HighlightCard
                            label="가치등급"
                            value={data.valueGrade}
                            isGrade
                            valueSuffix={data.valueScore != null ? `${data.valueScore.toFixed(1)} / 100` : null}
                            subLabel="종합(모멘텀·감점 포함)"
                            subValue={data.grade ? `${data.grade} · ${data.totalScore?.toFixed(1) ?? '-'}` : null}
                        />
                        <HighlightCard
                            label="타이밍"
                            value={data.timingSignal || '-'}
                            subLabel="타이밍 점수"
                            subValue={data.timingScore != null ? `${data.timingScore} / 100` : null}
                        />
                        <HighlightCard
                            label="현재가"
                            value={data.currentPrice ? `$${data.currentPrice}` : '-'}
                            onClick={data.currentPrice ? handleOpenChart : null}
                            clickable={!!data.currentPrice}
                        />
                        <HighlightCard
                            label="적정가치"
                            value={data.fairValue ? `$${data.fairValue}` : '-'}
                            subValue={(() => {
                                const parts = [];
                                if (data.resultDetail?.매수적정가 || data['매수적정가']) {
                                    const bp = data.resultDetail?.매수적정가 || data['매수적정가'];
                                    if (bp) parts.push(`매수: $${bp}`);
                                }
                                if (data.resultDetail?.목표매도가 || data['목표매도가']) {
                                    const st = data.resultDetail?.목표매도가 || data['목표매도가'];
                                    if (st) parts.push(`매도: $${st}`);
                                }
                                if (parts.length > 0) return parts.join(' / ');
                                const calculated = data.calFairValue;
                                if (calculated != null) {
                                    const calcNum = parseFloat(calculated);
                                    const fairNum = parseFloat(data.fairValue);
                                    if (!isNaN(calcNum) && (isNaN(fairNum) || Math.abs(calcNum - fairNum) > 0.01)) {
                                        return `$${calculated}`;
                                    }
                                }
                                return null;
                            })()}
                            subLabel={data.resultDetail?.매수적정가 || data['매수적정가'] ? '매수/매도 목표' : '계산된 주당가치'}
                        />
                    </div>

                    {/* 고평가 경고 배너 */}
                    {(() => {
                        const current = parseFloat(data.currentPrice);
                        const fair = parseFloat(data.fairValue);
                        if (!isNaN(current) && !isNaN(fair) && fair > 0 && current > fair) {
                            const overPct = ((current - fair) / fair * 100).toFixed(1);
                            return (
                                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 flex items-start gap-2">
                                    <span className="text-xl leading-none flex-shrink-0">🔴</span>
                                    <div className="text-sm text-red-800 dark:text-red-200 break-keep">
                                        현재가(<span className="font-semibold">${data.currentPrice}</span>)가 적정가(<span className="font-semibold">${data.fairValue}</span>)보다 <span className="font-bold text-red-600 dark:text-red-300">{overPct}%</span> 높음 — <span className="font-bold">고평가 주의</span>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Forward PER 경고 배너 */}
                    {data.forwardPerWarning && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-800 flex items-start gap-2">
                            <span className="text-xl leading-none flex-shrink-0">{'\u{1F7E1}'}</span>
                            <div className="text-sm text-amber-800 dark:text-amber-200 break-keep">
                                {data.forwardPerWarning}
                            </div>
                        </div>
                    )}

                    {/* 52주 고점 대비 하락률 경고 배너 */}
                    {(() => {
                        if (!data.high52wDropPercent) return null;
                        const dropPct = parseFloat(data.high52wDropPercent.replace('%', ''));
                        if (isNaN(dropPct) || dropPct > -20) return null;
                        const isSevere = dropPct <= -30;
                        return (
                            <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
                                isSevere
                                    ? 'bg-orange-50 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-800'
                                    : 'bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-800'
                            }`}>
                                <span className="text-xl leading-none flex-shrink-0">{isSevere ? '\u{1F4C9}' : '\u26A0\uFE0F'}</span>
                                <div className={`text-sm break-keep ${
                                    isSevere
                                        ? 'text-orange-800 dark:text-orange-200'
                                        : 'text-amber-800 dark:text-amber-200'
                                }`}>
                                    52주 고점 대비 <span className="font-bold">{data.high52wDropPercent}</span> 하락
                                    {isSevere ? ' — 강한 하락 추세, 추가 하락 가능성 주의' : ' — 하락 추세 주의'}
                                </div>
                            </div>
                        );
                    })()}

                    {/* 추천 (백엔드가 레거시 종합점수로 생성) */}
                    <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                        <div className="text-[11px] text-blue-600/80 dark:text-blue-300/70 mb-0.5">종합점수 기준 코멘트</div>
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-200">{data.recommendation || '-'}</div>
                    </div>

                    {/* 그레이엄 스크리닝 상세 */}
                    {data.resultDetail?.그레이엄_등급 && data.resultDetail.그레이엄_등급 !== 'N/A' && (() => {
                        const rd = data.resultDetail;
                        const grade = rd.그레이엄_등급;
                        const passCount = rd.그레이엄_통과수;
                        const perPass = rd.그레이엄_PER통과 === true;
                        const pbrPass = rd.그레이엄_PBR통과 === true;
                        const compositePass = rd.그레이엄_복합통과 === true;
                        const crPass = rd.그레이엄_유동비율통과 === true;
                        const profitPass = rd.그레이엄_연속흑자통과 === true;
                        const gradeColors = {
                            '강력매수': 'text-emerald-700 bg-emerald-50 border-emerald-300 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800',
                            '매수': 'text-blue-700 bg-blue-50 border-blue-300 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800',
                            '관망': 'text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800',
                            '위험': 'text-red-700 bg-red-50 border-red-300 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800',
                        };
                        const FilterBadge = ({ label, pass }) => (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                                pass
                                    ? 'text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-900/30'
                                    : 'text-red-700 border-red-300 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-900/30'
                            }`}>
                                {pass ? '✅' : '❌'} {label}
                            </span>
                        );
                        return (
                            <div className={`mb-4 w-full rounded-md border px-3 py-2 ${gradeColors[grade] || gradeColors['관망']}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[13px] font-semibold">그레이엄 스크리닝 ({passCount}/5)</span>
                                    <span className="text-[13px] font-bold">{grade}</span>
                                </div>
                                <div className="flex gap-1.5 flex-wrap">
                                    <FilterBadge label="PER" pass={perPass} />
                                    <FilterBadge label="PBR" pass={pbrPass} />
                                    <FilterBadge label="PER×PBR" pass={compositePass} />
                                    <FilterBadge label="유동비율" pass={crPass} />
                                    <FilterBadge label="연속흑자" pass={profitPass} />
                                </div>
                            </div>
                        );
                    })()}

                    {/* 진입 타이밍 분석 */}
                    <EntryTimingSection entryTiming={data.entryTiming} />

                    {/* 트레이딩 가이드 */}
                    <TradingGuideSection data={data} />

                    {/* 최근 뉴스 */}
                    <StockNewsSection symbol={data.symbol} />

                    {/* 가격 정보 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <InfoCard label="가격차이" value={data.priceDifference ? `$${data.priceDifference}` : '-'} />
                        <InfoCard label="가격차이율" value={data.priceGapPercent || '-'} />
                        <InfoCard label="PER" value={data.per ? parseFloat(data.per).toFixed(2) : '-'} />
                        <InfoCard label="PEG" value={data.peg || '-'} />
                        <InfoCard label="Forward PER" value={data.forwardPer || '-'} />
                        <InfoCard label="52주 고점 대비" value={data.high52wDropPercent || '-'} />
                    </div>

                    {/* 기업 정보 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <InfoCard label="섹터" value={data.sector || '-'} />
                        <InfoCard label="산업군" value={data.industry || '-'} />
                        <InfoCard label="거래소" value={data.exchange || '-'} />
                        <InfoCard label="시가총액" value={data.marketCap || '-'} />
                    </div>

                    {/* 단계별 점수 */}
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">단계별 평가</h4>
                        <div className="space-y-3">
                            {stepDetails.map((step) => (
                                <StepDetailCard key={step.stepNumber} step={step} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 기업 정보 모달 */}
            <CompanyInfoModal
                isOpen={companyInfoModal.open}
                onClose={() => setCompanyInfoModal({ open: false, symbol: null })}
                symbol={companyInfoModal.symbol}
                zIndex={zIndex + 100}
            />

            {/* 차트 모달 */}
            <StockChartModal
                isOpen={chartModal.open}
                onClose={() => setChartModal({ open: false, symbol: null, companyName: null })}
                symbol={chartModal.symbol}
                companyName={chartModal.companyName}
                zIndex={zIndex + 100}
            />

            {/* 기업가치 계산 결과 모달 */}
            <CompanyValueResultModal
                isOpen={companyValueModal.open}
                onClose={() => setCompanyValueModal({ open: false, data: null })}
                data={companyValueModal.data}
                fromInvestmentDetail={true}
            />

            {/* Alert 모달 */}
            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={handleCloseAlert}
            />
        </>
    );
};

/**
 * 전체 상세정보 모달 컴포넌트
 */
export const FullDetailModal = ({ isOpen, data, onClose, zIndex = 70 }) => {
    const modalRef = useRef(null);

    // ESC 키 핸들러
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    if (!shouldRender || !data) return null;

    const resultDetail = data.resultDetail || {};

    return (
        <>
            {/* 배경 오버레이 */}
            <div
                className={`fixed inset-0 bg-black/50 dark:bg-black/70 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
                style={{ zIndex: zIndex - 10, animationDuration: '0.25s' }}
                onClick={onClose}
            />

            {/* 모달 */}
            <div
                ref={modalRef}
                className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-xl rounded-lg max-h-[90vh] w-[min(900px,95vw)] overflow-hidden dark:bg-slate-800 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`}
                style={{ zIndex, animationDuration: '0.25s' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b bg-white z-10 dark:bg-slate-800 dark:border-slate-700">
                    <div>
                        <h2 className="text-lg font-semibold dark:text-white">전체 응답 데이터</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {data.symbol} - {data.companyName}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                            계산 버전: {data.calVersion}
                        </span>
                        <button
                            className="text-sm px-2 py-1 border rounded hover:bg-gray-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            onClick={onClose}
                        >
                            닫기 (Esc)
                        </button>
                    </div>
                </div>

                {/* 콘텐츠 */}
                <div className="p-4 overflow-y-auto overflow-x-hidden max-h-[calc(90vh-60px)]">
                    {/* 기본 정보 */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            기본 정보
                        </h4>
                        <div className="rounded-lg border bg-slate-50 dark:bg-slate-700 dark:border-slate-600 p-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[13px]">
                                {Object.entries(FIELD_LABELS).map(([key, label]) => {
                                    if (key.startsWith('step') || !data.hasOwnProperty(key)) return null;
                                    const value = data[key];
                                    const displayValue = SCORE_FIELDS.has(key) && typeof value === 'number' ? value.toFixed(1) : (value ?? '-');
                                    const valueStr = String(displayValue);

                                    // 적정가치인 경우 계산된주당가치도 함께 표시
                                    const calculatedValue = key === 'fairValue' ? data.calFairValue : null;
                                    const showCalculated = (() => {
                                        if (calculatedValue == null) return false;
                                        const calcNum = parseFloat(calculatedValue);
                                        const fairNum = parseFloat(value);
                                        return !isNaN(calcNum) && (isNaN(fairNum) || Math.abs(calcNum - fairNum) > 0.01);
                                    })();

                                    return (
                                        <div
                                            key={key}
                                            className="flex items-start justify-between gap-3 border-b last:border-b-0 py-1.5 dark:border-slate-600 group relative"
                                        >
                                            <div className="text-slate-500 whitespace-nowrap dark:text-slate-400">
                                                {label}
                                            </div>
                                            <div className="text-right font-medium dark:text-slate-200 max-w-[150px]">
                                                <div className="truncate" title={valueStr}>{displayValue}</div>
                                                {showCalculated && (
                                                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                        계산값: ${calculatedValue}
                                                    </div>
                                                )}
                                            </div>
                                            {valueStr.length > 20 && (
                                                <div className="absolute right-0 bottom-full mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 max-w-[280px] whitespace-normal break-all pointer-events-none">
                                                    {valueStr}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 단계별 점수 */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            단계별 점수
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <InfoCard label="1단계 (위험신호)" value={`${data.step1Score ?? '-'} / 12`} />
                            <InfoCard label="2단계 (신뢰도)" value={`${data.step2Score ?? '-'} / 18`} />
                            <InfoCard label="3단계 (밸류에이션)" value={`${data.step3Score ?? '-'} / 20`} />
                            <InfoCard label="4단계 (영업이익추세)" value={`${data.step4Score ?? '-'} / 15`} />
                            <InfoCard label="5단계 (투자적합성)" value={`${data.step5Score ?? '-'} / 17`} />
                            <InfoCard label="6단계 (모멘텀)" value={`${data.step6Score ?? '-'} / 18`} />
                        </div>
                    </div>

                    {/* 결과 상세 (resultDetail) */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                            결과 상세 (resultDetail)
                        </h4>
                        <div className="rounded-lg border bg-slate-50 dark:bg-slate-700 dark:border-slate-600 p-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[13px]">
                                {Object.entries(resultDetail).map(([key, value]) => {
                                    const formattedValue = formatResultDetailValue(key, value);
                                    const valueStr = String(formattedValue);
                                    return (
                                        <div
                                            key={key}
                                            className="flex items-start justify-between gap-3 border-b last:border-b-0 py-1.5 dark:border-slate-600 group relative"
                                        >
                                            <div className="text-slate-500 whitespace-nowrap dark:text-slate-400">
                                                {RESULT_DETAIL_LABELS[key] || key}
                                            </div>
                                            <div className="text-right font-medium dark:text-slate-200 truncate max-w-[150px]" title={valueStr}>
                                                {formattedValue}
                                            </div>
                                            {valueStr.length > 15 && (
                                                <div className="absolute right-0 bottom-full mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 max-w-[280px] whitespace-normal break-all pointer-events-none">
                                                    {valueStr}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 진입 타이밍 분석 */}
                    {data.entryTiming && (
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                                진입 타이밍 분석
                            </h4>
                            <div className="rounded-lg border bg-slate-50 dark:bg-slate-700 dark:border-slate-600 p-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[13px]">
                                    {Object.entries({
                                        signal: '시그널',
                                        signalColor: '시그널 색상',
                                        timingScore: '타이밍 점수',
                                        shortTermTrend: '단기 추세',
                                        trendDetail: '추세 상세',
                                        description: '설명',
                                        estimatedSupport: '예상 지지선',
                                        estimatedResistance: '예상 저항선',
                                        sma5: 'SMA5',
                                        sma20: 'SMA20',
                                        macdLine: 'MACD Line',
                                        macdSignal: 'MACD Signal',
                                        macdHistogram: 'MACD Histogram',
                                        bollingerUpper: '볼린저 상단',
                                        bollingerMiddle: '볼린저 중단',
                                        bollingerLower: '볼린저 하단',
                                        stochasticK: 'Stochastic %K',
                                        stochasticD: 'Stochastic %D',
                                        atr: 'ATR',
                                    }).map(([key, label]) => {
                                        const value = data.entryTiming[key];
                                        if (value == null) return null;
                                        const displayValue = typeof value === 'number' ? value.toFixed(2) : String(value);
                                        return (
                                            <div
                                                key={key}
                                                className="flex items-start justify-between gap-3 border-b last:border-b-0 py-1.5 dark:border-slate-600"
                                            >
                                                <div className="text-slate-500 whitespace-nowrap dark:text-slate-400">{label}</div>
                                                <div className="text-right font-medium dark:text-slate-200 truncate max-w-[150px]" title={displayValue}>
                                                    {displayValue}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 단계별 상세 설명 */}
                    {data.stepDetails && data.stepDetails.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                단계별 상세 설명
                            </h4>
                            <div className="space-y-3">
                                {data.stepDetails.map((step) => (
                                    <div key={step.stepNumber} className="rounded-lg border bg-slate-50 dark:bg-slate-700 dark:border-slate-600 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="font-medium text-slate-700 dark:text-slate-200">
                                                {step.stepNumber}단계: {step.stepName}
                                            </div>
                                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                                {step.score} / {step.maxScore}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{step.description}</p>
                                        <div className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 rounded p-2">
                                            {step.details}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default InvestmentDetailModal;
