import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { STOCK_ANALYSIS_PATH } from '@/config/menuPaths';
import { send } from '@/util/ClientUtil';
import useSessionKeepAlive from '@/hooks/useSessionKeepAlive';
import PageTitle from '@/component/common/display/PageTitle';
import Loading from '@/component/common/display/Loading';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import InvestmentDetailModal, { FullDetailModal } from '@/pages/trade/popup/InvestmentDetailModal';
import { GRADE_STYLE, GRADE_STYLE_DEFAULT, GRADE_EXCEL_ARGB } from '@/util/GradeStyleUtil';
import { SIGNAL_STYLE, SignalDot } from '@/util/SignalStyleUtil';
import { AlertTriangle } from 'lucide-react';
import ExcelJS from 'exceljs';

// 세션 스토리지 키
const SESSION_STORAGE_KEY = 'investmentEvaluationData';

// 시총 파싱 (포맷된 문자열 → 달러 숫자)
const parseMarketCap = (marketCap) => {
    if (!marketCap || marketCap === 'N/A') return null;
    const cleaned = marketCap.replace(/[$,]/g, '');
    const match = cleaned.match(/^([\d.]+)\s*([TBMK])?$/i);
    if (!match) return null;
    const num = parseFloat(match[1]);
    const unit = (match[2] || '').toUpperCase();
    if (unit === 'T') return num * 1e12;
    if (unit === 'B') return num * 1e9;
    if (unit === 'M') return num * 1e6;
    if (unit === 'K') return num * 1e3;
    return num;
};

// 소형주 유동성 리스크 판별
const SMALL_CAP_THRESHOLD = 1e9; // $1B
const MICRO_CAP_THRESHOLD = 3e8; // $300M
const getMarketCapRisk = (marketCap) => {
    const cap = parseMarketCap(marketCap);
    if (cap === null) return null;
    if (cap < MICRO_CAP_THRESHOLD) return { level: 'micro', label: '초소형주', desc: '시총 $300M 미만 — 유동성 매우 낮음, 스프레드 넓음, 급변동 위험' };
    if (cap < SMALL_CAP_THRESHOLD) return { level: 'small', label: '소형주', desc: '시총 $1B 미만 — 유동성 리스크 존재, 대량 매매 시 슬리피지 주의' };
    return null;
};

// 가격차이율 이상치 경고 판별
const PRICE_GAP_WARNING_THRESHOLD = 2000; // 2000% 이상이면 경고
const PRICE_GAP_EXTREME_THRESHOLD = 5000; // 5000% 이상이면 극단적 이상치

const getPriceGapWarning = (priceGapPercent, row) => {
    if (!priceGapPercent) return null;
    const numValue = parseFloat(priceGapPercent);
    if (isNaN(numValue)) return null;
    const absValue = Math.abs(numValue);
    if (absValue < PRICE_GAP_WARNING_THRESHOLD) return null;

    const reasons = [];

    // 1. 소형주 (시총 낮음)
    if (row?.marketCap) {
        const cap = row.marketCap.replace(/[^0-9.BMK]/g, '');
        const isSmallCap = row.marketCap.includes('M') || (row.marketCap.includes('B') && parseFloat(cap) < 1);
        if (isSmallCap) reasons.push('소형주 (낮은 시총)로 BPS/EPS 기반 적정가 신뢰도 낮음');
    }

    // 2. 중국 ADR
    if (row?.country === 'CN' || row?.country === 'HK') {
        reasons.push('중국 ADR — BPS가 높아도 지정학 리스크(상장폐지, VIE, 자본통제)로 시장에서 극단적 할인');
    }

    // 3. 심볼 패턴으로 비일반주식 의심
    const sym = row?.symbol || '';
    const name = (row?.companyName || '').toLowerCase();
    if (sym.endsWith('W') || sym.endsWith('WS') || sym.endsWith('WW') || name.includes('warrant')) {
        reasons.push('워런트(파생상품)로 의심 — 주당가치 계산 부적합');
    }
    if (name.includes('preferred') || name.includes('preference')) {
        reasons.push('우선주로 의심 — 보통주 재무데이터로 우선주 가치를 평가하면 부정확');
    }
    if (sym.includes('-RI') || name.includes('contingent')) {
        reasons.push('CVR(조건부가치권) — 일반 주식이 아님');
    }
    if (name.includes('bond') || name.includes('mortgage') || name.includes('debenture') || name.includes('series due')) {
        reasons.push('채권/모기지본드로 의심 — 주당가치 계산 대상 아님');
    }

    // 4. 현재가가 매우 낮음 ($1 미만)
    if (row?.currentPrice) {
        const price = parseFloat(row.currentPrice);
        if (!isNaN(price) && price < 1) {
            reasons.push(`현재가 $${price.toFixed(2)}로 페니스톡 — 소수점 가격에서 적정가 대비 비율이 극단적으로 확대됨`);
        }
    }

    // 5. IPO 직후 / 재무데이터 부족
    if (absValue > PRICE_GAP_EXTREME_THRESHOLD) {
        reasons.push('IPO 직후이거나 재무데이터(발행주식수 등) 오류 가능성');
    }

    // 기본 사유
    if (reasons.length === 0) {
        reasons.push('계산 모델의 한계 — 특정 업종/상황에서 BPS/EPS 기반 적정가가 시장가와 괴리');
    }

    return {
        level: absValue >= PRICE_GAP_EXTREME_THRESHOLD ? 'extreme' : 'warning',
        reasons,
    };
};

// 등급별 색상
const getGradeStyle = (grade) => GRADE_STYLE[grade] || GRADE_STYLE_DEFAULT;

// [2-1] 투자판정 배지 스타일 (색각이상 친화: 파랑/노랑/회색 — SignalStyleUtil 공통)
const getInvestmentSignalStyle = (signal) => SIGNAL_STYLE[signal] || SIGNAL_STYLE['관망'];

// [2-1] 타이밍 신호 스타일 (양호=파랑, 대기=노랑, 하락=주황, 관망=회색)
const getTimingStyle = (timing) => {
    const styles = {
        '양호': 'text-blue-600 dark:text-blue-400 font-semibold',
        '대기': 'text-amber-600 dark:text-amber-400 font-medium',
        '하락': 'text-orange-600 dark:text-orange-400 font-semibold',
        '관망': 'text-slate-500 dark:text-slate-400',
    };
    return styles[timing] || 'text-slate-500 dark:text-slate-400';
};

// 테이블 컬럼 정의
const TABLE_COLUMNS = [
    {
        key: 'symbol',
        label: '심볼',
        width: '90px',
        sortable: true,
        sticky: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left',
        render: (value, row, { onMouseEnter, onMouseLeave }) => (
            <span
                className="font-semibold text-slate-900 dark:text-white cursor-help"
                onMouseEnter={(e) => onMouseEnter(e, row?.companyName)}
                onMouseLeave={onMouseLeave}
            >
                {value}
            </span>
        ),
    },
    {
        key: 'companyName',
        label: '기업명',
        width: '200px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold',
        cellClassName: 'px-4 py-3 text-left text-slate-700 dark:text-slate-200',
        render: (value, row, { onMouseEnter, onMouseLeave }) => (
            <span
                className="block max-w-[180px] truncate cursor-help"
                onMouseEnter={(e) => onMouseEnter(e, value)}
                onMouseLeave={onMouseLeave}
                onClick={(e) => onMouseEnter(e, value)}
            >
                {value || '-'}
            </span>
        ),
    },
    {
        key: 'investmentSignal',
        label: '투자판정',
        width: '120px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-center text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-center',
        render: (value) => (
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${getInvestmentSignalStyle(value)}`}>
                <SignalDot signal={value} />
                {value || '-'}
            </span>
        ),
    },
    {
        key: 'valueGrade',
        label: '가치등급',
        width: '90px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-center text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-center',
        render: (value, row) => (
            <span className="inline-flex items-center gap-1">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${getGradeStyle(value)}`}>
                    {value || '-'}
                </span>
                {row?.valueScore != null && (
                    <span className="text-xs text-slate-400">{row.valueScore.toFixed(0)}</span>
                )}
            </span>
        ),
    },
    {
        key: 'timingSignal',
        label: '타이밍',
        width: '80px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-center text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-center',
        render: (value, row, { onMouseEnter, onMouseLeave }) => {
            if (!value) return '-';
            const timingScore = row?.timingScore;
            return (
                <span
                    className={`cursor-help ${getTimingStyle(value)}`}
                    onMouseEnter={(e) => onMouseEnter(e, row?.entryTiming?.description || (timingScore != null ? `타이밍 점수 ${timingScore}` : value))}
                    onMouseLeave={onMouseLeave}
                >
                    {value}
                </span>
            );
        },
    },
    {
        key: 'currentPrice',
        label: '현재가',
        width: '100px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right text-slate-600 dark:text-slate-300',
        render: (value) => value ? `$${value}` : '-',
    },
    {
        key: 'marketCap',
        label: '시총',
        width: '110px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value, row, { showWarning, hideWarning }) => {
            if (!value || value === 'N/A') return '-';
            const risk = getMarketCapRisk(value);
            if (!risk) return <span className="text-slate-600 dark:text-slate-300">{value}</span>;
            const content = (<>
                <span className="block font-bold text-amber-300 mb-1">{risk.label}</span>
                <span className="block text-slate-200">{risk.desc}</span>
            </>);
            return (
                <span className="inline-flex items-center gap-1 justify-end">
                    <span className={risk.level === 'micro'
                        ? 'text-orange-500 dark:text-orange-400 font-medium'
                        : 'text-amber-600 dark:text-amber-400'
                    }>
                        {value}
                    </span>
                    <span
                        className={`cursor-help text-xs ${risk.level === 'micro' ? 'text-orange-500' : 'text-amber-500'}`}
                        onMouseEnter={(e) => showWarning(e, content)}
                        onMouseLeave={hideWarning}
                        onClick={(e) => showWarning(e, content)}
                    >
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                </span>
            );
        },
    },
    {
        key: 'averageVolume',
        label: '평균거래량',
        width: '110px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value) => {
            if (!value) return '-';
            const vol = Number(value);
            const LOW_VOLUME = 100000;
            const formatted = vol >= 1e6 ? `${(vol / 1e6).toFixed(1)}M` : vol >= 1e3 ? `${(vol / 1e3).toFixed(0)}K` : vol.toString();
            if (vol < LOW_VOLUME) return <span className="text-orange-400 font-medium">{formatted}</span>;
            return <span className="text-slate-600 dark:text-slate-300">{formatted}</span>;
        },
    },
    {
        key: 'fairValue',
        label: '적정가치',
        width: '100px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value, row) => {
            if (!value) return '-';
            const warning = getPriceGapWarning(row?.priceGapPercent, row);
            return (
                <span className={warning
                    ? 'text-orange-400 line-through decoration-orange-400/50 dark:text-orange-500'
                    : 'text-slate-600 dark:text-slate-300'
                }>
                    ${value}
                </span>
            );
        },
    },
    {
        key: 'priceGapPercent',
        label: '가격차이율',
        width: '130px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value, row, { showWarning, hideWarning }) => {
            if (!value) return '-';
            const numValue = parseFloat(value);
            const isPositive = numValue > 0;
            const warning = getPriceGapWarning(value, row);
            const content = warning && (<>
                <span className="block font-bold text-amber-300 mb-1.5">
                    {warning.level === 'extreme' ? '극단적 이상치' : '이상치 경고'} — 가격차이율 {value}
                </span>
                <span className="block text-slate-300 mb-1.5">
                    이 수치는 신뢰하기 어렵습니다. 추정 원인:
                </span>
                {warning.reasons.map((reason, i) => (
                    <span key={i} className="block pl-2 border-l-2 border-amber-400/60 mb-1 text-slate-200">
                        {reason}
                    </span>
                ))}
                <span className="block mt-1.5 text-slate-400 italic">
                    이 종목의 적정가치를 투자 근거로 사용하지 마세요.
                </span>
            </>);
            return (
                <span className="inline-flex items-center gap-1 justify-end">
                    <span className={isPositive ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}>
                        {isPositive ? '+' : ''}{value}
                    </span>
                    {warning && (
                        <span
                            className={`cursor-help text-sm ${
                                warning.level === 'extreme'
                                    ? 'text-orange-500 animate-pulse'
                                    : 'text-amber-500'
                            }`}
                            onMouseEnter={(e) => showWarning(e, content)}
                            onMouseLeave={hideWarning}
                            onClick={(e) => showWarning(e, content)}
                        >
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                    )}
                </span>
            );
        },
    },
    {
        key: 'high52wDropPercent',
        label: '52주 고점대비',
        width: '110px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value) => {
            if (!value) return '-';
            const num = parseFloat(value.replace('%', ''));
            if (isNaN(num)) return '-';
            const isSevere = num <= -30;
            const isWarning = num <= -20;
            return (
                <span className={
                    isSevere ? 'text-orange-500 dark:text-orange-400 font-semibold' :
                    isWarning ? 'text-amber-600 dark:text-amber-400 font-medium' :
                    'text-slate-600 dark:text-slate-300'
                }>
                    {num > 0 ? '+' : ''}{num.toFixed(1)}%
                </span>
            );
        },
    },
    {
        key: 'forwardPer',
        label: 'Fwd PER',
        width: '90px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right',
        render: (value, row, { showWarning, hideWarning }) => {
            if (!value) return '-';
            const hasWarning = row?.forwardPerWarning;
            const content = hasWarning && (
                <>
                    <span className="block font-bold text-amber-300 mb-1">Forward PER 경고</span>
                    <span className="block text-slate-200">{row.forwardPerWarning}</span>
                </>
            );
            return (
                <span className="inline-flex items-center gap-1 justify-end">
                    <span className={hasWarning ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-600 dark:text-slate-300'}>
                        {value}
                    </span>
                    {hasWarning && (
                        <span
                            className="cursor-help text-xs text-amber-500"
                            onMouseEnter={(e) => showWarning(e, content)}
                            onMouseLeave={hideWarning}
                            onClick={(e) => showWarning(e, content)}
                        >
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                    )}
                </span>
            );
        },
    },
    {
        key: 'sector',
        label: '섹터',
        width: '150px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left text-slate-600 dark:text-slate-300',
    },
    {
        key: 'exchange',
        label: '거래소',
        width: '100px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left',
        render: (value) =>
            value ? (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {value}
                </span>
            ) : (
                '-'
            ),
    },
    {
        key: 'country',
        label: '국가',
        width: '80px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left',
        render: (value, row, { showWarning, hideWarning }) => {
            if (!value) return '-';
            const isChinaAdr = value === 'CN' || value === 'HK';
            const content = (<>
                <span className="block font-bold text-orange-300 mb-1">중국 ADR 리스크</span>
                <span className="block text-slate-200 mb-1">재무지표(BPS 등)는 양호하나 시장에서 크게 할인 거래됩니다.</span>
                <span className="block pl-2 border-l-2 border-orange-400/60 mb-0.5 text-slate-300">상장폐지 리스크 (SEC 감사 규제)</span>
                <span className="block pl-2 border-l-2 border-orange-400/60 mb-0.5 text-slate-300">VIE 구조 리스크 (실질 소유권 불확실)</span>
                <span className="block pl-2 border-l-2 border-orange-400/60 mb-0.5 text-slate-300">자본통제 / 지정학 리스크</span>
                <span className="block mt-1.5 text-slate-400 italic">적정가치가 과대 산출될 가능성이 높습니다.</span>
            </>);
            return (
                <span className="inline-flex items-center gap-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        isChinaAdr
                            ? 'bg-orange-50 text-orange-700 dark:bg-orange-900 dark:text-orange-200'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                        {value}
                    </span>
                    {isChinaAdr && (
                        <span
                            className="cursor-help text-xs text-orange-500"
                            onMouseEnter={(e) => showWarning(e, content)}
                            onMouseLeave={hideWarning}
                            onClick={(e) => showWarning(e, content)}
                        >
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                    )}
                </span>
            );
        },
    },
    {
        key: 'recommendation',
        label: '추천',
        width: '350px',
        sortable: false,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold',
        cellClassName: 'px-4 py-3 text-left text-slate-600 dark:text-slate-300 text-xs',
        render: (value, row) => {
            const warning = getPriceGapWarning(row?.priceGapPercent, row);
            if (warning) {
                return (
                    <span className="inline-flex items-center gap-1 text-orange-500 dark:text-orange-400 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />이상치 경고: 가격차이율({row.priceGapPercent})이 비현실적 — {warning.reasons[0]}
                    </span>
                );
            }
            return value || '-';
        },
    },
];

/**
 * 투자판단 페이지
 */
const InvestmentEvaluation = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    // URL 파라미터에서 symbol 추출 (KeepAlive로 다른 화면 URL에도 반응하므로 자기 경로일 때만)
    const symbolFromUrl = location.pathname === STOCK_ANALYSIS_PATH ? searchParams.get('symbol') : null;

    // 세션 스토리지에서 초기값 로드
    const getInitialData = () => {
        try {
            const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    symbolInput: parsed.symbolInput || '',
                    resultData: parsed.resultData || [],
                };
            }
        } catch {
            // 파싱 실패 시 기본값
        }
        return { symbolInput: '', resultData: [] };
    };

    const initialData = getInitialData();
    const [symbolInput, setSymbolInput] = useState(symbolFromUrl || initialData.symbolInput);
    const [resultData, setResultData] = useState(initialData.resultData);
    const [isLoading, setIsLoading] = useState(false);

    // 대량조회 중 세션 유지
    useSessionKeepAlive(isLoading);

    const [recentQueries, setRecentQueries] = useState([]);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });
    const [sortConfig, setSortConfig] = useState({ key: 'investmentSignal', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState({}); // {key: string[]} 멀티셀렉트
    const [filterSearch, setFilterSearch] = useState({}); // 드롭다운 내 검색어
    const [openDropdown, setOpenDropdown] = useState(null);
    const [detailModal, setDetailModal] = useState({ open: false, data: null });
    const [fullDetailModal, setFullDetailModal] = useState({ open: false, data: null });
    const [tooltip, setTooltip] = useState({ visible: false, text: '', x: 0, y: 0, rich: false });
    const [progress, setProgress] = useState({ current: 0, total: 0, status: '', waiting: false, remainingSeconds: 0, removedDuplicates: 0 });

    const inFlight = useRef({ fetch: false });
    const dropdownClosingRef = useRef(false);
    const abortRef = useRef(false);

    // 입력된 티커 정보 계산 (중복 감지 포함)
    const symbolInfo = useMemo(() => {
        if (!symbolInput.trim()) {
            return { total: 0, unique: 0, duplicates: [], duplicateCount: 0 };
        }
        const allSymbols = symbolInput
            .split(/[\n,\s]+/)
            .map((s) => s.trim().toUpperCase())
            .filter((s) => s.length > 0);

        const symbolCountMap = {};
        allSymbols.forEach((s) => {
            symbolCountMap[s] = (symbolCountMap[s] || 0) + 1;
        });

        const duplicates = Object.entries(symbolCountMap)
            .filter(([_, count]) => count > 1)
            .map(([symbol, count]) => ({ symbol, count }));

        const uniqueSymbols = [...new Set(allSymbols)];

        return {
            total: allSymbols.length,
            unique: uniqueSymbols.length,
            duplicates,
            duplicateCount: allSymbols.length - uniqueSymbols.length,
        };
    }, [symbolInput]);

    // 세션 스토리지에 데이터 저장
    useEffect(() => {
        if (resultData.length > 0) {
            try {
                sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
                    symbolInput,
                    resultData,
                }));
            } catch {
                // 저장 실패 무시
            }
        }
    }, [symbolInput, resultData]);

    // 최근 조회 내역 로드
    const loadRecentQueries = useCallback(async () => {
        const { data, error } = await send('/dart/main/evaluate/recent-queries', null, 'GET');
        if (!error && data?.response) {
            setRecentQueries(data.response);
        }
    }, []);

    useEffect(() => {
        loadRecentQueries();
    }, [loadRecentQueries]);

    // 드롭다운용 고유값 계산
    const getUniqueValuesForColumn = useCallback(
        (targetKey) => {
            const dropdownColumns = TABLE_COLUMNS.filter((col) => col.hasDropdown).map((col) => col.key);
            if (!dropdownColumns.includes(targetKey)) return [];

            const otherFilters = Object.entries(columnFilters).filter(
                ([key, value]) => {
                    if (key === targetKey) return false;
                    if (Array.isArray(value)) return value.length > 0;
                    return value !== '';
                }
            );

            let dataToFilter = resultData;
            if (otherFilters.length > 0) {
                dataToFilter = resultData.filter((row) => {
                    return otherFilters.every(([key, filterValue]) => {
                        const cellValue = row[key];
                        if (cellValue == null) return false;
                        if (Array.isArray(filterValue)) {
                            return filterValue.some(v => String(v).toLowerCase() === String(cellValue).toLowerCase());
                        }
                        return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
                    });
                });
            }

            return dataToFilter
                .map((row) => row[targetKey])
                .filter((v) => v != null && v !== '')
                .filter((v, i, arr) => arr.indexOf(v) === i)
                .sort((a, b) => String(a).localeCompare(String(b)));
        },
        [resultData, columnFilters]
    );

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        if (!openDropdown) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest('.filter-dropdown-container')) {
                dropdownClosingRef.current = true;
                setOpenDropdown(null);
                setTimeout(() => {
                    dropdownClosingRef.current = false;
                }, 100);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDropdown]);

    // Alert 관련 함수
    const openAlert = (message, onConfirm) => {
        setAlertConfig({ open: true, message, onConfirm: onConfirm || null });
    };

    const handleCloseAlert = () => {
        const { onConfirm } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null });
        if (onConfirm) onConfirm();
    };

    // 심볼 파싱
    const parseSymbols = (input) => {
        return input
            .split(/[\n,\s]+/)
            .map((s) => s.trim().toUpperCase())
            .filter((s) => s.length > 0);
    };

    // 배열을 n개씩 청크로 나누기
    const chunkArray = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    };

    // 대기 함수 (카운트다운 포함)
    const waitWithCountdown = async (seconds) => {
        for (let i = seconds; i > 0; i--) {
            if (abortRef.current) return false;
            setProgress((prev) => ({ ...prev, waiting: true, remainingSeconds: i }));
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        setProgress((prev) => ({ ...prev, waiting: false, remainingSeconds: 0 }));
        return true;
    };

    // 분석 실행 (50개씩 분할)
    // inputOverride: 다른 화면에서 넘겨받은 심볼 문자열 (버튼 클릭 시엔 이벤트 객체가 오므로 문자열일 때만 사용)
    const handleAnalyze = useCallback(async (inputOverride) => {
        const allSymbols = parseSymbols(typeof inputOverride === 'string' ? inputOverride : symbolInput);
        if (allSymbols.length === 0) {
            openAlert('분석할 티커를 입력해주세요.');
            return;
        }

        // 중복 제거
        const symbols = [...new Set(allSymbols)];
        const removedCount = allSymbols.length - symbols.length;

        if (inFlight.current.fetch) return;
        inFlight.current.fetch = true;
        abortRef.current = false;

        // 최근 조회 내역 저장 (전체 심볼 리스트, 배치 분할 전)
        send('/dart/main/evaluate/recent-queries', { symbols }, 'POST')
            .then(() => loadRecentQueries())
            .catch(() => {});

        const BATCH_SIZE = 50;
        const WAIT_SECONDS = 15;
        const chunks = chunkArray(symbols, BATCH_SIZE);
        const totalChunks = chunks.length;

        setIsLoading(true);
        setResultData([]);
        setProgress({ current: 0, total: totalChunks, status: '', waiting: false, remainingSeconds: 0, removedDuplicates: removedCount });

        const allResults = [];

        try {
            for (let i = 0; i < chunks.length; i++) {
                if (abortRef.current) {
                    setProgress((prev) => ({ ...prev, status: '중지됨' }));
                    break;
                }

                const chunk = chunks[i];
                const startIdx = i * BATCH_SIZE + 1;
                const endIdx = Math.min((i + 1) * BATCH_SIZE, symbols.length);

                setProgress((prev) => ({
                    ...prev,
                    current: i + 1,
                    status: `${startIdx}~${endIdx}번째 조회 중...`,
                    waiting: false,
                }));

                try {
                    const { data, error } = await send('/dart/main/evaluate/stocks', { symbols: chunk }, 'POST');

                    if (!error && data && data.response) {
                        const list = Array.isArray(data.response) ? data.response : [];
                        allResults.push(...list);
                        setResultData([...allResults]);
                    }
                } catch (e) {
                    // 개별 청크 실패 시 계속 진행
                }

                // 마지막 청크가 아니고 중지되지 않았으면 대기
                if (i < chunks.length - 1 && !abortRef.current) {
                    const shouldContinue = await waitWithCountdown(WAIT_SECONDS);
                    if (!shouldContinue) {
                        setProgress((prev) => ({ ...prev, status: '중지됨', waiting: false }));
                        break;
                    }
                }
            }

            if (!abortRef.current) {
                setProgress((prev) => ({ ...prev, status: '완료', waiting: false }));
            }

            if (allResults.length === 0) {
                openAlert('분석 결과가 없습니다.');
            }
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
            inFlight.current.fetch = false;
            loadRecentQueries();
            // 2초 후 진행상태 초기화
            setTimeout(() => {
                setProgress({ current: 0, total: 0, status: '', waiting: false, remainingSeconds: 0, removedDuplicates: 0 });
            }, 2000);
        }
    }, [symbolInput]);

    // 분석 중지
    const handleStopAnalyze = useCallback(() => {
        abortRef.current = true;
        setProgress((prev) => ({ ...prev, status: '중지 중...', waiting: false }));
    }, []);

    // URL 파라미터에서 symbol이 있으면 자동 조회
    // (화면이 이미 열려 있어 이전 결과가 있어도 넘겨받은 심볼로 새로 조회)
    useEffect(() => {
        if (symbolFromUrl && !isLoading) {
            // URL 파라미터 제거
            setSearchParams({});
            // 입력창에도 반영 후 자동 조회 실행
            setSymbolInput(symbolFromUrl);
            handleAnalyze(symbolFromUrl);
        }
    }, [symbolFromUrl, isLoading, handleAnalyze, setSearchParams]);

    // 필터링된 데이터
    // 지원 문법:
    // - 일반 검색: "fin" → fin 포함된 데이터
    // - 제외 검색: "!fin" → fin 포함된 데이터 제외
    // - OR 검색: "fin|tech" → fin 또는 tech 포함된 데이터
    // - AND 검색: "fin&tech" → fin과 tech 모두 포함된 데이터
    // - 제외 OR 검색: "!fin|tech" → fin 또는 tech 포함된 데이터 제외 (= fin도 제외, tech도 제외)
    // - 제외 AND 검색: "!fin&tech" → fin도 제외, tech도 제외
    const filteredData = useMemo(() => {
        const activeFilters = Object.entries(columnFilters).filter(([_, value]) => {
            if (Array.isArray(value)) return value.length > 0;
            return value !== '';
        });
        if (activeFilters.length === 0) return resultData;

        return resultData.filter((row) => {
            return activeFilters.every(([key, filterValue]) => {
                const cellValue = row[key];
                if (cellValue == null) return false;
                const cellStr = String(cellValue).toLowerCase();

                // 멀티셀렉트 (배열)
                if (Array.isArray(filterValue)) {
                    return filterValue.some(v => String(v).toLowerCase() === cellStr);
                }

                // 텍스트 검색 (하위 호환)
                const isExclude = filterValue.startsWith('!');
                const actualFilter = isExclude ? filterValue.slice(1) : filterValue;

                if (actualFilter.includes('&')) {
                    const andTerms = actualFilter.split('&').map(t => t.trim().toLowerCase()).filter(t => t);
                    return isExclude ? andTerms.every(term => !cellStr.includes(term)) : andTerms.every(term => cellStr.includes(term));
                }

                if (actualFilter.includes('|')) {
                    const orTerms = actualFilter.split('|').map(t => t.trim().toLowerCase()).filter(t => t);
                    return isExclude ? orTerms.every(term => !cellStr.includes(term)) : orTerms.some(term => cellStr.includes(term));
                }

                const filterStr = actualFilter.toLowerCase();
                const matches = cellStr.includes(filterStr);
                return isExclude ? !matches : matches;
            });
        });
    }, [resultData, columnFilters]);

    // 정렬된 데이터
    const sortedData = useMemo(() => {
        if (!sortConfig.key) return filteredData;

        // [2-1] 카테고리형 컬럼은 의미 순서로 정렬 (알파벳순 방지)
        const SIGNAL_RANK = { '매수 후보': 3, '관심목록': 2, '관망': 1 };
        const TIMING_RANK = { '양호': 4, '대기': 3, '관망': 2, '하락': 1 };
        const rankMap = sortConfig.key === 'investmentSignal' ? SIGNAL_RANK
            : sortConfig.key === 'timingSignal' ? TIMING_RANK : null;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // 카테고리형: 랭크 우선 정렬, 동순위는 가치점수 내림차순 보조
            if (rankMap) {
                const aRank = rankMap[aVal] || 0;
                const bRank = rankMap[bVal] || 0;
                if (aRank !== bRank) return sortConfig.direction === 'asc' ? aRank - bRank : bRank - aRank;
                const aScore = a.valueScore ?? 0;
                const bScore = b.valueScore ?? 0;
                return bScore - aScore;
            }

            // 숫자 정렬 (문자열 숫자도 처리)
            const aNum = typeof aVal === 'string' ? parseFloat(aVal) : aVal;
            const bNum = typeof bVal === 'string' ? parseFloat(bVal) : bVal;

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
            }

            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            return sortConfig.direction === 'asc'
                ? aStr.localeCompare(bStr)
                : bStr.localeCompare(aStr);
        });
    }, [filteredData, sortConfig]);

    // 컬럼 필터 핸들러 (텍스트)
    const handleColumnFilterChange = useCallback((key, value) => {
        setColumnFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    }, []);

    // 멀티셀렉트 토글
    const toggleFilterValue = useCallback((key, value) => {
        setColumnFilters((prev) => {
            const current = Array.isArray(prev[key]) ? prev[key] : [];
            const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
            return { ...prev, [key]: next };
        });
    }, []);

    // 전체 선택/해제
    const toggleAllFilterValues = useCallback((key, allValues) => {
        setColumnFilters((prev) => {
            const current = Array.isArray(prev[key]) ? prev[key] : [];
            const next = current.length === allValues.length ? [] : [...allValues];
            return { ...prev, [key]: next };
        });
    }, []);

    // 필터 초기화
    const clearColumnFilters = useCallback(() => {
        setColumnFilters({});
        setFilterSearch({});
    }, []);

    // 정렬 핸들러
    const handleSort = useCallback((key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    }, []);

    // 툴팁 핸들러
    const handleTooltipEnter = useCallback((e, text) => {
        if (!text) return;
        const rect = e.target.getBoundingClientRect();
        const vw = window.innerWidth;
        // 모바일: 요소 아래에 표시, 데스크톱: 요소 오른쪽에 표시
        const isMobile = vw < 640;
        setTooltip({
            visible: true,
            text,
            x: isMobile ? Math.min(rect.left, vw - 16) : rect.right + 8,
            y: isMobile ? rect.bottom + 6 : rect.top + rect.height / 2,
            mobile: isMobile,
        });
    }, []);

    const handleTooltipLeave = useCallback(() => {
        setTooltip((prev) => ({ ...prev, visible: false }));
    }, []);

    // 경고 툴팁 (리치 콘텐츠) - 데스크톱: hover, 모바일: 터치
    const showWarningTooltip = useCallback((e, content) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const vw = window.innerWidth;
        const isMobile = vw < 640;
        setTooltip({
            visible: true,
            text: content,
            x: isMobile ? 16 : Math.min(rect.left, vw - 320),
            y: isMobile ? rect.bottom + 8 : rect.top - 8,
            mobile: isMobile,
            rich: true,
        });
    }, []);

    const hideWarningTooltip = useCallback(() => {
        setTooltip((prev) => prev.rich ? { ...prev, visible: false } : prev);
    }, []);

    // 모바일: 다른 곳 탭하면 툴팁 닫기
    useEffect(() => {
        if (!tooltip.visible || !tooltip.mobile) return;
        const hide = () => setTooltip((prev) => ({ ...prev, visible: false }));
        const timer = setTimeout(() => document.addEventListener('touchstart', hide, { once: true }), 10);
        return () => { clearTimeout(timer); document.removeEventListener('touchstart', hide); };
    }, [tooltip.visible, tooltip.mobile]);

    // 엑셀 다운로드 (ExcelJS - 색상 스타일링 포함)
    const handleExportToExcel = useCallback(async () => {
        if (sortedData.length === 0) {
            openAlert('다운로드할 데이터가 없습니다.');
            return;
        }

        try {
            const wb = new ExcelJS.Workbook();

            // === 1. 투자판단 결과 시트 ===
            const ws = wb.addWorksheet('투자판단 결과');

            // 컬럼 정의
            ws.columns = [
                { header: '심볼', key: 'symbol', width: 10 },
                { header: '기업명', key: 'companyName', width: 30 },
                { header: '투자판정', key: 'investmentSignal', width: 12 },
                { header: '가치등급', key: 'valueGrade', width: 10 },
                { header: '가치점수', key: 'valueScore', width: 10 },
                { header: '타이밍', key: 'timingSignal', width: 8 },
                { header: '등급(레거시)', key: 'grade', width: 12 },
                { header: '총점(레거시)', key: 'totalScore', width: 12 },
                { header: '현재가', key: 'currentPrice', width: 12 },
                { header: '시총', key: 'marketCap', width: 14 },
                { header: '평균거래량', key: 'averageVolume', width: 14 },
                { header: '적정가치', key: 'fairValue', width: 12 },
                { header: '가격차이율', key: 'priceGapPercent', width: 14 },
                { header: '섹터', key: 'sector', width: 20 },
                { header: '거래소', key: 'exchange', width: 10 },
                { header: '국가', key: 'country', width: 8 },
                { header: '추천', key: 'recommendation', width: 55 },
            ];

            // 등급별 행 배경색 (적록색약 친화)
            const gradeFills = Object.fromEntries(Object.entries(GRADE_EXCEL_ARGB).map(([g, argb]) => [
                g, { type: 'pattern', pattern: 'solid', fgColor: { argb } },
            ]));
            const warningFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }; // orange-50
            const warningFont = { color: { argb: 'FFEA580C' } }; // orange-600
            const extremeFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }; // orange-200 (경고 orange-50 보다 진하게)
            const extremeFont = { color: { argb: 'FF9A3412' }, bold: true }; // orange-800

            // 데이터 행 추가
            sortedData.forEach((row) => {
                const warning = getPriceGapWarning(row.priceGapPercent, row);
                const dataRow = ws.addRow({
                    symbol: row.symbol || '',
                    companyName: row.companyName || '',
                    investmentSignal: row.investmentSignal || '',
                    valueGrade: row.valueGrade || '',
                    valueScore: row.valueScore != null ? Number(row.valueScore.toFixed(1)) : '',
                    timingSignal: row.timingSignal || '',
                    grade: row.grade || '',
                    totalScore: row.totalScore != null ? Number(row.totalScore.toFixed(1)) : '',
                    currentPrice: row.currentPrice ? `$${row.currentPrice}` : '',
                    marketCap: (() => {
                        const risk = getMarketCapRisk(row.marketCap);
                        if (risk) return `${row.marketCap} [${risk.label}]`;
                        return row.marketCap || 'N/A';
                    })(),
                    averageVolume: row.averageVolume ? Number(row.averageVolume) : '',
                    fairValue: row.fairValue ? `$${row.fairValue}` : '',
                    priceGapPercent: row.priceGapPercent || '',
                    sector: row.sector || '',
                    exchange: row.exchange || '',
                    country: (() => {
                        const c = row.country || '';
                        return (c === 'CN' || c === 'HK') ? `${c} [중국ADR]` : c;
                    })(),
                    recommendation: warning
                        ? `[이상치 경고] ${warning.reasons.join(' / ')}`
                        : (row.recommendation || ''),
                });

                const capRisk = getMarketCapRisk(row.marketCap);
                const smallCapFont = { color: { argb: 'FFEA580C' } }; // orange-600
                const microCapFont = { color: { argb: 'FF9A3412' }, bold: true }; // orange-800 (소형주 orange-600 보다 진하게)
                const isChinaAdr = row.country === 'CN' || row.country === 'HK';

                // 중국 ADR 국가 셀 강조
                if (isChinaAdr) {
                    dataRow.getCell('country').font = { color: { argb: 'FFEA580C' }, bold: true }; // orange-600
                    dataRow.getCell('country').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }; // orange-50
                }

                if (warning) {
                    // 이상치 행: 주황/빨강 강조
                    const isExtreme = warning.level === 'extreme';
                    dataRow.eachCell((cell) => {
                        cell.fill = isExtreme ? extremeFill : warningFill;
                    });
                    // 가격차이율, 적정가치, 추천 셀 폰트 색상
                    dataRow.getCell('priceGapPercent').font = isExtreme ? extremeFont : warningFont;
                    dataRow.getCell('fairValue').font = isExtreme ? extremeFont : warningFont;
                    dataRow.getCell('recommendation').font = isExtreme ? extremeFont : warningFont;
                } else {
                    // 등급별 배경색
                    const fill = gradeFills[row.grade];
                    if (fill) {
                        dataRow.eachCell((cell) => { cell.fill = fill; });
                    }
                }

                // 소형주 시총 셀 색상 (이상치와 별개로 적용)
                if (capRisk) {
                    dataRow.getCell('marketCap').font = capRisk.level === 'micro' ? microCapFont : smallCapFont;
                }

                // 저거래량 셀 색상 (10만주 미만)
                if (row.averageVolume && Number(row.averageVolume) < 100000) {
                    dataRow.getCell('averageVolume').font = smallCapFont;
                }
            });

            // 헤더 스타일
            const headerRow = ws.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // slate-700
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

            // === 2. 범례 시트 ===
            const legendWs = wb.addWorksheet('범례');
            legendWs.columns = [
                { header: '구분', key: 'category', width: 18 },
                { header: '색상/표시', key: 'color', width: 20 },
                { header: '의미', key: 'meaning', width: 60 },
            ];

            const legendHeader = legendWs.getRow(1);
            legendHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            legendHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

            // 등급별 범례
            const legendItems = [
                { category: '등급 S', fill: gradeFills.S, meaning: '92점 이상 — 강력 매수 추천 (저평가 + 재무 건전성 + 성장성 우수)' },
                { category: '등급 A', fill: gradeFills.A, meaning: '83~91점 — 매수 추천 (안정적 재무구조 + 합리적 밸류에이션)' },
                { category: '등급 B', fill: gradeFills.B, meaning: '73~82점 — 매수 고려 가능 (전반적 양호, 일부 주의 필요)' },
                { category: '등급 C', fill: gradeFills.C, meaning: '63~72점 — 신중한 검토 필요 (리스크 요인 존재)' },
                { category: '등급 D', fill: gradeFills.D, meaning: '50~62점 — 투자 주의 (여러 리스크 요인)' },
                { category: '등급 F', fill: gradeFills.F, meaning: '50점 미만 — 투자 비추천 (높은 리스크)' },
                { category: '', fill: null, meaning: '' },
                { category: '이상치 경고', fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }, meaning: `가격차이율 ${PRICE_GAP_WARNING_THRESHOLD}% 이상 — 적정가치 신뢰 불가, 주황색 텍스트` },
                { category: '극단적 이상치', fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }, meaning: `가격차이율 ${PRICE_GAP_EXTREME_THRESHOLD}% 이상 — 적정가치 완전 신뢰 불가, 빨간색 볼드 텍스트` },
                { category: '', fill: null, meaning: '' },
                { category: '이상치 원인', fill: null, meaning: '' },
                { category: '  소형주', fill: null, meaning: '시총이 낮아 BPS/EPS 기반 적정가 신뢰도가 낮음' },
                { category: '  중국 ADR', fill: null, meaning: 'BPS가 높아도 지정학 리스크(상장폐지, VIE, 자본통제)로 시장에서 극단적 할인' },
                { category: '  비일반주식', fill: null, meaning: '워런트/우선주/CVR/채권 등 — 보통주 기반 주당가치 계산이 부적합' },
                { category: '  페니스톡', fill: null, meaning: '현재가 $1 미만 — 소수점 가격에서 적정가 비율이 극단적으로 확대' },
                { category: '  데이터 오류', fill: null, meaning: 'IPO 직후이거나 발행주식수 등 재무데이터 오류 가능성' },
                { category: '', fill: null, meaning: '' },
                { category: '유동성 리스크', fill: null, meaning: '' },
                { category: '  소형주', fill: null, meaning: '시총 $1B 미만 — 유동성 리스크, 대량 매매 시 슬리피지 주의 (주황색 텍스트)' },
                { category: '  초소형주', fill: null, meaning: '시총 $300M 미만 — 유동성 매우 낮음, 스프레드 넓음, 급변동 위험 (빨간색 볼드)' },
                { category: '', fill: null, meaning: '' },
                { category: '국가 리스크', fill: null, meaning: '' },
                { category: '  중국 ADR', fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }, meaning: 'CN/HK — 상장폐지 리스크, VIE 구조, 자본통제, 지정학 리스크로 적정가치가 과대 산출될 가능성 높음 (국가 셀 주황색)' },
            ];

            legendItems.forEach((item) => {
                const row = legendWs.addRow({
                    category: item.category,
                    color: item.fill ? '' : '',
                    meaning: item.meaning,
                });
                if (item.fill) {
                    row.getCell('color').fill = item.fill;
                    row.getCell('color').value = item.category.includes('이상치') || item.category.includes('극단')
                        ? '■ 이 색상' : '■ 이 색상';
                }
                if (item.category === '') {
                    row.font = { italic: true, color: { argb: 'FF94A3B8' } };
                }
            });

            // 파일 다운로드
            const today = new Date();
            const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
            const filename = `투자판단_${dateStr}.xlsx`;

            const buf = await wb.xlsx.writeBuffer();
            const blob = new Blob([buf], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();

            openAlert(`엑셀 파일이 다운로드되었습니다.\n파일명: ${filename}\n총 ${sortedData.length}건`);
        } catch (error) {
            console.error('Excel export error:', error);
            openAlert('엑셀 파일 생성 중 오류가 발생했습니다.');
        }
    }, [sortedData, openAlert]);

    // CSV 다운로드
    const handleExportToCsv = useCallback(() => {
        if (sortedData.length === 0) {
            openAlert('다운로드할 데이터가 없습니다.');
            return;
        }

        try {
            const headers = ['심볼', '기업명', '투자판정', '가치등급', '가치점수', '타이밍', '등급(레거시)', '총점(레거시)', '현재가', '시총', '평균거래량', '적정가치', '가격차이율', '섹터', '거래소', '국가', '추천'];
            const rows = sortedData.map((row) => {
                const w = getPriceGapWarning(row.priceGapPercent, row);
                const capRisk = getMarketCapRisk(row.marketCap);
                return [
                    row.symbol || '',
                    row.companyName || '',
                    row.investmentSignal || '',
                    row.valueGrade || '',
                    row.valueScore != null ? row.valueScore.toFixed(1) : '',
                    row.timingSignal || '',
                    row.grade || '',
                    row.totalScore != null ? row.totalScore.toFixed(1) : '',
                    row.currentPrice ? `$${row.currentPrice}` : '',
                    capRisk ? `${row.marketCap} [${capRisk.label}]` : (row.marketCap || 'N/A'),
                    row.averageVolume ? Number(row.averageVolume).toLocaleString() : '',
                    row.fairValue ? `$${row.fairValue}` : '',
                    row.priceGapPercent || '',
                    row.sector || '',
                    row.exchange || '',
                    (() => {
                        const c = row.country || '';
                        return (c === 'CN' || c === 'HK') ? `${c} [중국ADR]` : c;
                    })(),
                    w ? `[이상치 경고] ${w.reasons.join(' / ')}` : (row.recommendation || ''),
                ];
            });

            const escapeCsvField = (field) => {
                const str = String(field);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const csvContent = '\uFEFF' + [
                headers.map(escapeCsvField).join(','),
                ...rows.map((row) => row.map(escapeCsvField).join(',')),
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            const today = new Date();
            const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
            const filename = `투자판단_${dateStr}.csv`;

            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            openAlert(`CSV 파일이 다운로드되었습니다.\n파일명: ${filename}\n총 ${sortedData.length}건`);
        } catch (error) {
            console.error('CSV export error:', error);
            openAlert('CSV 파일 생성 중 오류가 발생했습니다.');
        }
    }, [sortedData, openAlert]);

    // 행 클릭 -> 상세정보 모달
    const handleRowClick = useCallback((row) => {
        if (dropdownClosingRef.current) return;
        setDetailModal({ open: true, data: row });
    }, []);

    // 전체 상세보기 열기
    const handleOpenFullDetail = useCallback((data) => {
        setFullDetailModal({ open: true, data });
    }, []);

    // Enter 키로 분석 실행
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleAnalyze();
        }
    };

    return (
        <>
            <PageTitle />
            <div className="mb-6">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    티커 심볼을 입력하고 분석 버튼을 눌러 투자 판단 정보를 확인하세요. 여러 티커는 줄바꿈, 쉼표, 공백으로 구분합니다.
                </p>

                {/* 최근 조회 내역 */}
                {recentQueries.length > 0 && (
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">최근 조회:</span>
                        {recentQueries.map((q, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setSymbolInput(q.symbols.join(', '))}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-blue-900 dark:hover:text-blue-200 transition-colors"
                                title={q.symbols.join(', ')}
                            >
                                <span className="font-medium">{q.symbolCount}종목</span>
                                <span className="text-slate-400 dark:text-slate-500">
                                    {q.symbols.length <= 3 ? q.symbols.join(', ') : `${q.symbols.slice(0, 3).join(', ')} ...`}
                                </span>
                                <span className="text-slate-400 dark:text-slate-500 text-[10px]">{q.queriedAt}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* 입력 영역 */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex flex-col gap-3">
                        <textarea
                            value={symbolInput}
                            onChange={(e) => setSymbolInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="티커 심볼 입력 (예: AAPL, MSFT, GOOGL)"
                            rows={6}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 resize-none"
                        />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Ctrl + Enter로 분석 실행
                                </span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${symbolInfo.total > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                    {symbolInfo.duplicateCount > 0 ? (
                                        <>
                                            {symbolInfo.unique}개 (중복 {symbolInfo.duplicateCount}개 제외)
                                        </>
                                    ) : (
                                        <>{symbolInfo.total}개 입력</>
                                    )}
                                    {symbolInfo.unique > 50 && (
                                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                                            ({Math.ceil(symbolInfo.unique / 50)}회 분할조회)
                                        </span>
                                    )}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {isLoading && progress.total > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleStopAnalyze}
                                        disabled={progress.status === '중지 중...'}
                                        className={`px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                            progress.status === '중지 중...'
                                                ? 'bg-slate-400 text-white cursor-not-allowed'
                                                : 'bg-orange-500 text-white hover:bg-orange-600'
                                        }`}
                                    >
                                        {progress.status === '중지 중...' ? (
                                            <>
                                                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                중지 중...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                중지
                                            </>
                                        )}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleAnalyze}
                                    disabled={isLoading || !symbolInput.trim()}
                                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            분석 중...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            분석
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* 중복 심볼 경고 */}
                        {symbolInfo.duplicates.length > 0 && (
                            <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                                <div className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex-1">
                                        <div className="text-xs font-medium text-amber-800 dark:text-amber-200">
                                            중복 심볼 {symbolInfo.duplicates.length}종 발견 (분석 시 자동 제거됨)
                                        </div>
                                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300 flex flex-wrap gap-1">
                                            {symbolInfo.duplicates.slice(0, 10).map(({ symbol, count }) => (
                                                <span key={symbol} className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                                                    {symbol} <span className="ml-0.5 text-amber-600 dark:text-amber-400">×{count}</span>
                                                </span>
                                            ))}
                                            {symbolInfo.duplicates.length > 10 && (
                                                <span className="text-amber-600 dark:text-amber-400">
                                                    외 {symbolInfo.duplicates.length - 10}개
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 진행 상태 표시 */}
                        {progress.total > 1 && (
                            <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            진행 상황: {progress.current} / {progress.total} 배치
                                        </span>
                                        {progress.removedDuplicates > 0 && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                                                중복 {progress.removedDuplicates}개 제거됨
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                        progress.status === '완료' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200' :
                                        progress.status === '중지됨' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' :
                                        'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                    }`}>
                                        {progress.waiting ? `대기 중... ${progress.remainingSeconds}초` : progress.status}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-600">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    ></div>
                                </div>
                                {progress.waiting && (
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        API 제한으로 인해 다음 배치 요청 전 대기 중입니다...
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 분할 조회 시에는 진행 상태 표시로 대체 */}
            <Loading show={isLoading && progress.total <= 1} />

            {/* 분석 결과 테이블 */}
            {resultData.length > 0 && (
                <div className="bg-white border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">분석 결과</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={handleExportToExcel}
                                disabled={sortedData.length === 0}
                                className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                엑셀 다운로드
                            </button>
                            <button
                                type="button"
                                onClick={handleExportToCsv}
                                disabled={sortedData.length === 0}
                                className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                CSV 다운로드
                            </button>
                            {Object.values(columnFilters).some((v) => Array.isArray(v) ? v.length > 0 : v !== '') && (
                                <button
                                    type="button"
                                    onClick={clearColumnFilters}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600"
                                >
                                    필터 초기화
                                </button>
                            )}
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium text-sm dark:bg-blue-900 dark:text-blue-200">
                                {filteredData.length !== resultData.length
                                    ? `${filteredData.length} / ${resultData.length}건`
                                    : `${resultData.length}건`}
                            </span>
                        </div>
                    </div>
                    <div className="overflow-x-auto overflow-y-auto scrollbar-always max-h-[70vh]" style={{ scrollbarGutter: 'stable' }}>
                      <div style={{ minWidth: '1500px' }}>
                        <table
                            className="w-full table-fixed text-sm divide-y divide-slate-200 dark:divide-slate-700"
                        >
                            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    {TABLE_COLUMNS.map((col) => (
                                        <th
                                            key={col.key}
                                            className={`${col.headerClassName} ${col.sortable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none' : ''} ${col.sticky ? 'sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]' : ''}`}
                                            style={{ width: col.width }}
                                            onClick={() => col.sortable && handleSort(col.key)}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span className="flex-1">{col.label}</span>
                                                {col.sortable && (
                                                    <span className="flex flex-col text-[10px] leading-none opacity-60">
                                                        <span
                                                            className={
                                                                sortConfig.key === col.key && sortConfig.direction === 'asc'
                                                                    ? 'opacity-100 text-blue-600 dark:text-blue-400'
                                                                    : ''
                                                            }
                                                        >
                                                            ▲
                                                        </span>
                                                        <span
                                                            className={
                                                                sortConfig.key === col.key && sortConfig.direction === 'desc'
                                                                    ? 'opacity-100 text-blue-600 dark:text-blue-400'
                                                                    : ''
                                                            }
                                                        >
                                                            ▼
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                                {/* 필터 입력 행 */}
                                <tr className="bg-slate-100 dark:bg-slate-700">
                                    {TABLE_COLUMNS.map((col) => {
                                        const selected = Array.isArray(columnFilters[col.key]) ? columnFilters[col.key] : [];
                                        const hasActiveFilter = col.hasDropdown ? selected.length > 0 : (columnFilters[col.key] || '') !== '';
                                        return (
                                            <th
                                                key={`filter-${col.key}`}
                                                className={`px-2 py-2 ${col.sticky ? 'sticky left-0 z-20 bg-slate-100 dark:bg-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]' : ''}`}
                                                style={{ width: col.width }}
                                            >
                                                <div className="relative filter-dropdown-container">
                                                    {col.hasDropdown ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenDropdown(openDropdown === col.key ? null : col.key)}
                                                                className={`w-full flex items-center justify-between px-2 py-1 text-xs rounded border bg-white text-slate-700 outline-none dark:bg-slate-600 dark:text-white ${
                                                                    hasActiveFilter
                                                                        ? 'border-blue-500 ring-1 ring-blue-500'
                                                                        : 'border-slate-300 dark:border-slate-500'
                                                                }`}
                                                            >
                                                                <span className="truncate">
                                                                    {hasActiveFilter ? `${selected.length}개 선택` : '전체'}
                                                                </span>
                                                                <svg className={`w-3 h-3 shrink-0 transition-transform ${openDropdown === col.key ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </button>
                                                            {openDropdown === col.key && (() => {
                                                                const options = getUniqueValuesForColumn(col.key);
                                                                const search = (filterSearch[col.key] || '').toLowerCase();
                                                                const filtered = search ? options.filter(v => String(v).toLowerCase().includes(search)) : options;
                                                                return options.length > 0 && (
                                                                    <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-slate-300 rounded-lg shadow-xl z-50 dark:bg-slate-700 dark:border-slate-600">
                                                                        {/* 검색 */}
                                                                        <div className="p-2 border-b border-slate-200 dark:border-slate-600">
                                                                            <input
                                                                                type="text"
                                                                                value={filterSearch[col.key] || ''}
                                                                                onChange={(e) => setFilterSearch(prev => ({ ...prev, [col.key]: e.target.value }))}
                                                                                placeholder="검색..."
                                                                                className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-white dark:placeholder-slate-400"
                                                                                autoFocus
                                                                            />
                                                                        </div>
                                                                        {/* 전체 선택/해제 */}
                                                                        <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-600 flex items-center gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleAllFilterValues(col.key, filtered)}
                                                                                className="text-[11px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                                                            >
                                                                                {selected.length === filtered.length ? '전체 해제' : '전체 선택'}
                                                                            </button>
                                                                            {hasActiveFilter && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleColumnFilterChange(col.key, [])}
                                                                                    className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                                                                                >
                                                                                    초기화
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {/* 체크박스 목록 */}
                                                                        <div className="max-h-48 overflow-y-auto">
                                                                            {filtered.map((value) => (
                                                                                <label
                                                                                    key={value}
                                                                                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 cursor-pointer dark:text-slate-200 dark:hover:bg-slate-600"
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={selected.includes(value)}
                                                                                        onChange={() => toggleFilterValue(col.key, value)}
                                                                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-600"
                                                                                    />
                                                                                    <span className="truncate">{value}</span>
                                                                                </label>
                                                                            ))}
                                                                            {filtered.length === 0 && (
                                                                                <div className="px-3 py-2 text-xs text-slate-400">결과 없음</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={columnFilters[col.key] || ''}
                                                            onChange={(e) => handleColumnFilterChange(col.key, e.target.value)}
                                                            placeholder="필터..."
                                                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-white dark:placeholder-slate-400"
                                                        />
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                                {sortedData.map((row, idx) => (
                                    <tr
                                        key={`${row.symbol}-${idx}`}
                                        className="hover:bg-blue-50 cursor-pointer transition-colors dark:hover:bg-slate-700"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => !isLoading && handleRowClick(row)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                !isLoading && handleRowClick(row);
                                            }
                                        }}
                                    >
                                        {TABLE_COLUMNS.map((col) => {
                                            const value = row[col.key];
                                            const tooltipHandlers = {
                                                onMouseEnter: handleTooltipEnter,
                                                onMouseLeave: handleTooltipLeave,
                                                showWarning: showWarningTooltip,
                                                hideWarning: hideWarningTooltip,
                                            };
                                            const displayValue = col.render ? col.render(value, row, tooltipHandlers) : value ?? '-';

                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`${col.cellClassName} ${col.sticky ? 'sticky left-0 z-[5] bg-white dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                                                    style={{ width: col.width }}
                                                >
                                                    {displayValue}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      </div>
                    </div>
                </div>
            )}

            {/* Alert 모달 */}
            <AlertModal open={alertConfig.open} message={alertConfig.message} onClose={handleCloseAlert} />

            {/* 상세정보 모달 (A) */}
            <InvestmentDetailModal
                isOpen={detailModal.open}
                data={detailModal.data}
                onClose={() => setDetailModal({ open: false, data: null })}
                onOpenFullDetail={handleOpenFullDetail}
            />

            {/* 전체 상세정보 모달 (B) */}
            <FullDetailModal
                isOpen={fullDetailModal.open}
                data={fullDetailModal.data}
                onClose={() => setFullDetailModal({ open: false, data: null })}
            />

            {/* 커스텀 툴팁 */}
            {tooltip.visible && (
                <div
                    className={`fixed z-[9999] text-xs bg-slate-800 text-white rounded-lg shadow-lg border border-slate-600 ${
                        tooltip.rich
                            ? 'p-3 max-w-[min(20rem,90vw)] whitespace-normal leading-relaxed'
                            : `px-2 py-1 pointer-events-none ${tooltip.mobile ? 'max-w-[90vw] whitespace-normal break-words' : 'whitespace-nowrap'}`
                    }`}
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                        transform: tooltip.rich
                            ? (tooltip.mobile ? 'none' : 'translateY(-100%)')
                            : (tooltip.mobile ? 'none' : 'translateY(-50%)'),
                    }}
                >
                    {tooltip.text}
                </div>
            )}
        </>
    );
};

export default InvestmentEvaluation;
