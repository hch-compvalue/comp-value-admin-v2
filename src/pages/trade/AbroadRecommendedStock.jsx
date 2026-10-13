import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { send, API_ENDPOINTS } from '@/util/ClientUtil';
import useModalAnimation from '@/hooks/useModalAnimation';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import PageTitle from '@/component/common/display/PageTitle';
import Loading from '@/component/common/display/Loading';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import CompanyValueResultModal from '@/pages/trade/popup/CompanyValueResultModal';
import { STOCK_ANALYSIS_PATH, SUB_TAB } from '@/config/menuPaths';
import MultiSelect from '@/component/common/select/MultiSelect';
import DualRangeSlider from '@/component/common/input/DualRangeSlider';

// 로컬스토리지 키
const SCHEDULE_RUN_KEY = 'lastRecommendedStockScheduleRun';

// 숫자를 천 단위 콤마 포맷으로 변환
const formatNumberWithComma = (value) => {
    if (value === null || value === '' || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    return num.toLocaleString('en-US');
};

// 날짜 포맷 (YYYYMMDD -> YYYY-MM-DD)
const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return '-';
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

// 시간 포맷 (HHMMSS -> HH:MM:SS)
const formatTime = (timeStr) => {
    if (!timeStr || timeStr.length < 6) return '-';
    return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;
};

// 데이터 신선도 판정 기준 (추천 스케줄은 매일 1회 실행 → 하루 이상 지나면 갱신 누락 의심)
const DATE_STR_LENGTH = 8;   // YYYYMMDD
const TIME_STR_LENGTH = 6;   // HHMMSS
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STALE_WARN_DAYS = 2;   // 2일 이상 경과 → 주의(노랑)
const STALE_ALERT_DAYS = 7;  // 7일 이상 경과 → 경고(주황)

// 목록의 trscDt/trscTm 중 가장 최근 값으로 "이 데이터가 언제 만들어졌는지" 산출
const getSnapshotInfo = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    let latest = null;
    for (const row of rows) {
        const dt = row?.trscDt;
        if (typeof dt !== 'string' || dt.length !== DATE_STR_LENGTH) continue;
        const tm = typeof row?.trscTm === 'string' ? row.trscTm : '';
        const key = dt + tm.padEnd(TIME_STR_LENGTH, '0').slice(0, TIME_STR_LENGTH);
        if (latest === null || key > latest) latest = key;
    }
    if (latest === null) return null;

    const dateStr = latest.slice(0, DATE_STR_LENGTH);
    const timeStr = latest.slice(DATE_STR_LENGTH);
    const snapshot = new Date(
        Number(dateStr.slice(0, 4)),
        Number(dateStr.slice(4, 6)) - 1,
        Number(dateStr.slice(6, 8)),
    );
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysAgo = Math.floor((today - snapshot) / MS_PER_DAY);

    return { dateStr, timeStr, daysAgo };
};

// 경과일 라벨 (0일=오늘, 1일=어제, 그 외 N일 전)
const formatDaysAgo = (daysAgo) => {
    if (daysAgo <= 0) return '오늘';
    if (daysAgo === 1) return '어제';
    return `${daysAgo}일 전`;
};

/**
 * 조회 시점 배지
 * - 스케줄 미실행 시 과거 스냅샷(Redis 24h 캐시 → DB 최신 스냅샷 폴백)이 그대로 표시되므로,
 *   목록이 언제 만들어진 데이터인지 상단에서 바로 확인할 수 있게 한다.
 * - 색상: 색각이상 친화 팔레트 (파랑=최신 / 노랑=주의 / 주황=오래됨)
 */
const SnapshotBadge = ({ info }) => {
    if (!info) return null;

    const { dateStr, timeStr, daysAgo } = info;
    const tone = daysAgo >= STALE_ALERT_DAYS
        ? 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
        : daysAgo >= STALE_WARN_DAYS
            ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
            : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${tone}`}
            title="추천 스케줄이 실제로 실행된 시각입니다. 스케줄이 돌지 않으면 마지막 실행 결과가 그대로 표시됩니다."
        >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            조회 {formatDate(dateStr)} {formatTime(timeStr)} · {formatDaysAgo(daysAgo)}
            {daysAgo >= STALE_ALERT_DAYS && <span className="font-semibold">· 갱신 안 됨</span>}
        </span>
    );
};

// 필드 레이블 매핑 (영문 -> 한글)
const FIELD_LABELS = {
    symbol: '심볼',
    companyName: '기업명',
    marketCap: '시가총액',
    sector: '섹터',
    industry: '산업군',
    beta: '베타',
    price: '주가',
    lastAnnualDividend: '연간배당금',
    volume: '거래량',
    exchange: '거래소',
    exchangeShortName: '거래소',
    country: '국가',
    peRatioTTM: 'PER (TTM)',
    priceToBookRatioTTM: 'PBR (TTM)',
    returnOnEquityTTM: 'ROE (TTM)',
    debtEquityRatioTTM: '부채비율 (TTM)',
    dividendYieldTTM: '배당수익률 (TTM)',
    currentRatioTTM: '유동비율 (TTM)',
    netProfitMarginTTM: '순이익률 (TTM)',
    operatingProfitMarginTTM: '영업이익률 (TTM)',
    returnOnAssetsTTM: 'ROA (TTM)',
    priceToSalesRatioTTM: 'PSR (TTM)',
    enterpriseValueMultipleTTM: 'EV Multiple (TTM)',
    avgRevenueGrowth: '매출성장률(3Y)',
    avgNetIncomeGrowth: '순이익성장률(3Y)',
    trscDt: '조회일자',
    trscTm: '조회시간',
    매수적정가: '매수적정가',
    목표매도가: '목표매도가',
    그레이엄_PER통과: '그레이엄 PER',
    그레이엄_PBR통과: '그레이엄 PBR',
    그레이엄_복합통과: '그레이엄 PER×PBR',
    그레이엄_유동비율통과: '그레이엄 유동비율',
    그레이엄_연속흑자통과: '그레이엄 연속흑자',
    그레이엄_통과수: '그레이엄 통과수',
    그레이엄_등급: '그레이엄 등급',
};

// 값 포맷팅 (필드별 특수 포맷)
const formatFieldValue = (key, value) => {
    if (value === null || value === undefined || value === '') return '-';

    switch (key) {
        case 'marketCap':
        case 'volume':
            return formatNumberWithComma(value);
        case 'price':
        case 'lastAnnualDividend':
            return `$${typeof value === 'number' ? value.toFixed(2) : value}`;
        case 'beta':
        case 'peRatioTTM':
        case 'priceToBookRatioTTM':
        case 'priceToSalesRatioTTM':
        case 'enterpriseValueMultipleTTM':
        case 'currentRatioTTM':
            return typeof value === 'number' ? value.toFixed(2) : value;
        case 'returnOnEquityTTM':
        case 'returnOnAssetsTTM':
        case 'netProfitMarginTTM':
        case 'operatingProfitMarginTTM':
        case 'dividendYieldTTM':
        case 'debtEquityRatioTTM':
        case 'avgRevenueGrowth':
        case 'avgNetIncomeGrowth':
            return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : value;
        case 'trscDt':
            return formatDate(value);
        case 'trscTm':
            return formatTime(value);
        default:
            return String(value);
    }
};

// 테이블 컬럼 정의 (요청된 컬럼들만 표시)
const TABLE_COLUMNS = [
    {
        key: 'symbol',
        label: '심볼',
        width: '100px',
        sortable: true,
        sticky: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
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
        width: '280px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left text-slate-700 dark:text-slate-200',
    },
    {
        key: 'marketCap',
        label: '시가총액',
        width: '140px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right text-slate-600 dark:text-slate-300',
        render: (value) => formatNumberWithComma(value),
    },
    {
        key: 'sector',
        label: '섹터',
        width: '180px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left text-slate-600 dark:text-slate-300',
    },
    {
        key: 'industry',
        label: '산업군',
        width: '220px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left text-slate-600 dark:text-slate-300',
    },
    {
        key: 'beta',
        label: '베타',
        width: '80px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-right text-slate-600 dark:text-slate-300',
        render: (value) => (value != null ? value.toFixed(3) : '-'),
    },
    {
        key: 'exchangeShortName',
        label: '거래소',
        width: '100px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
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
        width: '90px',
        sortable: true,
        hasDropdown: true,
        headerClassName: 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-left text-slate-600 dark:text-slate-300',
    },
    {
        key: 'trscDt',
        label: '조회일자',
        width: '110px',
        sortable: true,
        headerClassName: 'px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 whitespace-nowrap text-center text-slate-600 dark:text-slate-300',
        render: (value) => formatDate(value),
    },
    {
        key: 'trscTm',
        label: '조회시간',
        width: '100px',
        sortable: true,
        headerClassName: 'px-4 py-3 pr-8 text-center text-xs font-semibold uppercase tracking-wider',
        cellClassName: 'px-4 py-3 pr-8 whitespace-nowrap text-center text-slate-600 dark:text-slate-300',
        render: (value) => formatTime(value),
    },
];

/**
 * 미국 추천기업 페이지
 * - 매일 오전 10시에 조회된 추천기업 데이터를 표시
 */
const AbroadRecommendedStock = () => {
    const [resultData, setResultData] = useState([]);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [columnFilters, setColumnFilters] = useState({});
    const [compValueData, setCompValueData] = useState({});
    const [showValueModal, setShowValueModal] = useState(false);
    const [tooltip, setTooltip] = useState({ visible: false, text: '', x: 0, y: 0 });
    const [openDropdown, setOpenDropdown] = useState(null);
    const [detailModal, setDetailModal] = useState({ open: false, data: null });
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const { shouldRender: renderScheduleModal, isAnimatingOut: isScheduleModalClosing } = useModalAnimation(showScheduleModal, 250);
    const [maxCountInput, setMaxCountInput] = useState('');
    const [lastScheduleRun, setLastScheduleRun] = useState(null);
    const [profiles, setProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState('');
    const [showProfileSettingModal, setShowProfileSettingModal] = useState(false);
    const [allProfiles, setAllProfiles] = useState([]);
    const [selectedProfileForEdit, setSelectedProfileForEdit] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editFormData, setEditFormData] = useState(null);

    const inFlight = useRef({ fetch: false, calc: false });
    const dropdownClosingRef = useRef(false);

    // 필터 옵션 조회 (거래소 등)
    const { options: filterOptions, loading: filterOptionsLoading } = useFilterOptions();

    // 슈퍼관리자 여부 확인
    const isSuperAdmin = useMemo(() => {
        let storedRoles = [];
        try {
            const raw = localStorage.getItem('roles');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    storedRoles = parsed;
                }
            }
        } catch {
            storedRoles = [];
        }
        const effectiveRoles = storedRoles.map((r) => (r || '').toString().toUpperCase());
        return effectiveRoles.some((r) => r.includes('SUPER_ADMIN'));
    }, []);

    // 로컬스토리지에서 마지막 스케줄 실행 시간 확인 및 1시간 지난 값 삭제
    useEffect(() => {
        const storedTime = localStorage.getItem(SCHEDULE_RUN_KEY);
        if (storedTime) {
            const runTime = new Date(storedTime);
            const now = new Date();
            const hoursDiff = (now - runTime) / (1000 * 60 * 60);

            if (hoursDiff >= 1) {
                // 1시간 이상 지났으면 삭제
                localStorage.removeItem(SCHEDULE_RUN_KEY);
                setLastScheduleRun(null);
            } else {
                setLastScheduleRun(runTime);
            }
        }
    }, []);

    // 드롭다운용 고유값 계산
    const getUniqueValuesForColumn = useCallback(
        (targetKey) => {
            const dropdownColumns = TABLE_COLUMNS.filter((col) => col.hasDropdown).map((col) => col.key);
            if (!dropdownColumns.includes(targetKey)) return [];

            const otherFilters = Object.entries(columnFilters).filter(
                ([key, value]) => key !== targetKey && value !== ''
            );

            let dataToFilter = resultData;
            if (otherFilters.length > 0) {
                dataToFilter = resultData.filter((row) => {
                    return otherFilters.every(([key, filterValue]) => {
                        const cellValue = row[key];
                        if (cellValue == null) return false;
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

    // Alert 관련 함수
    const openAlert = useCallback((message, onConfirm) => {
        setAlertConfig({ open: true, message, onConfirm: onConfirm || null });
    }, []);

    const handleCloseAlert = useCallback(() => {
        const { onConfirm } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null });
        if (onConfirm) onConfirm();
    }, [alertConfig]);

    // 추천기업 데이터 조회
    const fetchRecommendedStocks = useCallback(async (profileName) => {
        if (inFlight.current.fetch) return;
        if (!profileName) return;

        inFlight.current.fetch = true;

        setIsLoading(true);
        try {
            const { data, error } = await send('/dart/main/rem/usstock', { profileName }, 'POST');

            if (!error && data && data.response) {
                const list = Array.isArray(data.response) ? data.response : [];
                setResultData(list);
            } else {
                setResultData([]);
                openAlert('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            }
        } catch (e) {
            setResultData([]);
            openAlert('요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
            inFlight.current.fetch = false;
        }
    }, [openAlert]);

    // 활성 프로파일 목록 조회
    const fetchProfiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await send('/dart/recommend/profile/active', {}, 'GET');

            if (!error && data && data.response) {
                const list = Array.isArray(data.response) ? data.response : [];
                setProfiles(list);
                // 첫 번째 프로파일을 기본 선택
                if (list.length > 0) {
                    setSelectedProfile(list[0].profileName);
                }
            } else {
                setProfiles([]);
                openAlert('프로파일 목록을 불러오지 못했습니다.');
            }
        } catch (e) {
            setProfiles([]);
            openAlert('프로파일 조회 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [openAlert]);

    // 전체 프로파일 목록 조회 (설정 모달용)
    const fetchAllProfiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await send('/dart/recommend/profile', {}, 'GET');

            if (!error && data && data.response) {
                const list = Array.isArray(data.response) ? data.response : [];
                setAllProfiles(list);
            } else {
                setAllProfiles([]);
                openAlert('전체 프로파일 목록을 불러오지 못했습니다.');
            }
        } catch (e) {
            setAllProfiles([]);
            openAlert('프로파일 조회 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [openAlert]);

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

    // 초기 데이터 로드
    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    // 프로파일 선택이 변경되면 자동으로 데이터 조회
    useEffect(() => {
        if (selectedProfile) {
            fetchRecommendedStocks(selectedProfile);
        }
    }, [selectedProfile, fetchRecommendedStocks]);

    // 필터링된 데이터
    // 지원 문법:
    // - 일반 검색: "fin" → fin 포함된 데이터
    // - 제외 검색: "!fin" → fin 포함된 데이터 제외
    // - OR 검색: "fin|tech" → fin 또는 tech 포함된 데이터
    // - AND 검색: "fin&tech" → fin과 tech 모두 포함된 데이터
    // - 제외 OR 검색: "!fin|tech" → fin 또는 tech 포함된 데이터 제외 (= fin도 제외, tech도 제외)
    // - 제외 AND 검색: "!fin&tech" → fin도 제외, tech도 제외
    // 목록 데이터의 생성 시점 (스케줄 실행 시각)
    const snapshotInfo = useMemo(() => getSnapshotInfo(resultData), [resultData]);

    const filteredData = useMemo(() => {
        const activeFilters = Object.entries(columnFilters).filter(([_, value]) => value !== '');
        if (activeFilters.length === 0) return resultData;

        return resultData.filter((row) => {
            return activeFilters.every(([key, filterValue]) => {
                const cellValue = row[key];
                if (cellValue == null) return false;
                const cellStr = String(cellValue).toLowerCase();

                // 제외 검색 (!로 시작)
                const isExclude = filterValue.startsWith('!');
                const actualFilter = isExclude ? filterValue.slice(1) : filterValue;

                // AND 검색 (&로 구분)
                if (actualFilter.includes('&')) {
                    const andTerms = actualFilter.split('&').map(t => t.trim().toLowerCase()).filter(t => t);
                    if (isExclude) {
                        // !a&b = a 제외 AND b 제외 (둘 중 하나라도 포함되면 제외)
                        return andTerms.every(term => !cellStr.includes(term));
                    } else {
                        // a&b = a 포함 AND b 포함
                        return andTerms.every(term => cellStr.includes(term));
                    }
                }

                // OR 검색 (|로 구분)
                if (actualFilter.includes('|')) {
                    const orTerms = actualFilter.split('|').map(t => t.trim().toLowerCase()).filter(t => t);
                    if (isExclude) {
                        // !a|b = a 제외 AND b 제외 (둘 중 하나라도 포함되면 제외)
                        return orTerms.every(term => !cellStr.includes(term));
                    } else {
                        // a|b = a 포함 OR b 포함
                        return orTerms.some(term => cellStr.includes(term));
                    }
                }

                // 일반 검색
                const filterStr = actualFilter.toLowerCase();
                const matches = cellStr.includes(filterStr);
                return isExclude ? !matches : matches;
            });
        });
    }, [resultData, columnFilters]);

    // 정렬된 데이터
    const sortedData = useMemo(() => {
        if (!sortConfig.key) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            return sortConfig.direction === 'asc'
                ? aStr.localeCompare(bStr)
                : bStr.localeCompare(aStr);
        });
    }, [filteredData, sortConfig]);

    // 컬럼 필터 핸들러
    const handleColumnFilterChange = useCallback((key, value) => {
        setColumnFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    }, []);

    // 필터 초기화
    const clearColumnFilters = useCallback(() => {
        setColumnFilters({});
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
        setTooltip({
            visible: true,
            text,
            x: rect.right + 8,
            y: rect.top + rect.height / 2,
        });
    }, []);

    const handleTooltipLeave = useCallback(() => {
        setTooltip((prev) => ({ ...prev, visible: false }));
    }, []);

    // 행 클릭 -> 상세정보 모달
    const handleRowClick = useCallback((row) => {
        if (dropdownClosingRef.current) return;
        setDetailModal({ open: true, data: row });
    }, []);

    // 체크박스 선택 핸들러
    const handleSelectRow = useCallback((symbol, checked) => {
        setSelectedRows((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(symbol);
            } else {
                next.delete(symbol);
            }
            return next;
        });
    }, []);

    // 전체 선택/해제
    const handleSelectAll = useCallback((checked) => {
        if (checked) {
            const allSymbols = sortedData.map((row) => row.symbol);
            setSelectedRows(new Set(allSymbols));
        } else {
            setSelectedRows(new Set());
        }
    }, [sortedData]);

    // 선택된 심볼 배열
    const selectedSymbols = useMemo(() => {
        return sortedData.filter((row) => selectedRows.has(row.symbol)).map((row) => row.symbol);
    }, [sortedData, selectedRows]);

    // 전체 선택 여부
    const isAllSelected = useMemo(() => {
        return sortedData.length > 0 && sortedData.every((row) => selectedRows.has(row.symbol));
    }, [sortedData, selectedRows]);

    // 부분 선택 여부
    const isPartialSelected = useMemo(() => {
        return selectedRows.size > 0 && !isAllSelected;
    }, [selectedRows, isAllSelected]);

    // 선택 종목을 종목 분석 > 일괄 평가로 넘겨 바로 평가 실행
    const handleEvaluateSelected = useCallback(() => {
        if (selectedSymbols.length === 0) {
            openAlert('분석할 기업을 선택해주세요.');
            return;
        }
        const query = new URLSearchParams({ symbol: selectedSymbols.join(',') });
        navigate(`${STOCK_ANALYSIS_PATH}?${query}`, { state: { subTab: SUB_TAB.EVALUATE } });
    }, [selectedSymbols, navigate]);

    // maxCount 입력값 유효성 검사
    const isMaxCountValid = useMemo(() => {
        if (maxCountInput === '') return false;
        const num = parseInt(maxCountInput, 10);
        return !isNaN(num) && num >= 0;
    }, [maxCountInput]);

    // 추천기업 스케줄 실행 (슈퍼관리자 전용)
    const handleRunSchedule = useCallback(async () => {
        if (!isMaxCountValid) return;

        const maxCount = parseInt(maxCountInput, 10);
        setIsLoading(true);
        setShowScheduleModal(false);

        try {
            const { data, error } = await send('/dart/schd/recommended-stocks', { maxCount }, 'POST');

            if (error) {
                if (data?.code === '40301') {
                    openAlert('접근 권한이 없습니다.');
                } else {
                    openAlert(data?.message || '스케줄 실행 중 오류가 발생했습니다.');
                }
            } else {
                // 성공 시 로컬스토리지에 실행 시간 저장
                const now = new Date();
                localStorage.setItem(SCHEDULE_RUN_KEY, now.toISOString());
                setLastScheduleRun(now);
                openAlert(`추천기업 조회 스케줄이 실행되었습니다.\n(maxCount=${maxCount})`);
            }
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
            setMaxCountInput('');
        }
    }, [maxCountInput, isMaxCountValid]);

    // 상세정보 모달에서 분석 버튼 클릭
    const handleAnalyze = useCallback(async (symbol) => {
        if (!symbol?.trim()) {
            openAlert('심볼 정보가 존재하지 않습니다.');
            return;
        }

        if (inFlight.current.calc) return;
        inFlight.current.calc = true;

        setIsLoading(true);
        try {
            const { data, error } = await send(
                API_ENDPOINTS.ABROAD_COMP_VALUE(symbol),
                {},
                'GET'
            );

            const hasValid = !error && data && data.response && Object.keys(data.response).length > 0;
            if (hasValid) {
                setCompValueData(data.response);
                setShowValueModal(true);
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
    }, []);

    return (
        <>
            <PageTitle />
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    매일 오전 10시에 자동으로 조회된 추천 기업 목록입니다. 행을 클릭하면 상세 정보를 볼 수 있습니다.
                </p>
                {isSuperAdmin && (
                    <div className="flex items-center gap-2">
                        {lastScheduleRun && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                                마지막 수동 실행: {lastScheduleRun.toLocaleString('ko-KR')}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setShowProfileSettingModal(true);
                                fetchAllProfiles();
                            }}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg border border-emerald-600 bg-white text-emerald-600 text-xs font-medium hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-slate-700 flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            설정
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowScheduleModal(true)}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            추천기업 조회
                        </button>
                    </div>
                )}
            </div>

            <Loading show={isLoading} />

            {/* 프로파일 선택 영역 */}
            <div className="mb-4 flex items-center gap-3">
                <label htmlFor="profile-select" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    프로파일:
                </label>
                <select
                    id="profile-select"
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    disabled={isLoading || profiles.length === 0}
                    className="max-w-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                    {profiles.length === 0 ? (
                        <option value="">프로파일 없음</option>
                    ) : (
                        profiles.map((profile) => (
                            <option key={profile.id} value={profile.profileName}>
                                {profile.profileName}
                            </option>
                        ))
                    )}
                </select>
            </div>

            {/* 조회 결과 테이블 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">추천 기업 목록</h3>
                        <SnapshotBadge info={snapshotInfo} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleEvaluateSelected}
                            disabled={isLoading || selectedSymbols.length === 0}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            일괄 평가 {selectedSymbols.length > 0 && `(${selectedSymbols.length})`}
                        </button>
                        {selectedRows.size > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedRows(new Set())}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                선택 해제
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => fetchRecommendedStocks(selectedProfile)}
                            disabled={isLoading || !selectedProfile}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            새로고침
                        </button>
                        {Object.values(columnFilters).some((v) => v !== '') && (
                            <button
                                type="button"
                                onClick={clearColumnFilters}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                필터 초기화
                            </button>
                        )}
                        {resultData.length > 0 && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium text-sm dark:bg-blue-900 dark:text-blue-200">
                                {filteredData.length !== resultData.length
                                    ? `${filteredData.length} / ${resultData.length}건`
                                    : `${resultData.length}건`}
                            </span>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto overflow-y-auto scrollbar-always max-h-[70vh]" style={{ scrollbarGutter: 'stable' }}>
                    <table
                        className="text-sm divide-y divide-slate-200 dark:divide-slate-700"
                        style={{ width: '100%', tableLayout: 'fixed' }}
                    >
                        <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-700 to-slate-600 text-white">
                            <tr>
                                {/* 전체 선택 체크박스 */}
                                <th className="px-3 py-3 text-center w-[50px] sticky left-0 z-20 bg-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = isPartialSelected;
                                        }}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                </th>
                                {TABLE_COLUMNS.map((col) => (
                                    <th
                                        key={col.key}
                                        className={`${col.headerClassName} ${col.sortable ? 'cursor-pointer hover:bg-slate-500 select-none' : ''} ${col.sticky ? 'sticky left-[50px] z-20 bg-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]' : ''}`}
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
                                                                ? 'opacity-100 text-yellow-300'
                                                                : ''
                                                        }
                                                    >
                                                        ▲
                                                    </span>
                                                    <span
                                                        className={
                                                            sortConfig.key === col.key && sortConfig.direction === 'desc'
                                                                ? 'opacity-100 text-yellow-300'
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
                                {/* 체크박스 열 빈 셀 */}
                                <th className="px-3 py-2 w-[50px] sticky left-0 z-20 bg-slate-100 dark:bg-slate-700"></th>
                                {TABLE_COLUMNS.map((col) => (
                                    <th
                                        key={`filter-${col.key}`}
                                        className={`px-2 py-2 ${col.sticky ? 'sticky left-[50px] z-20 bg-slate-100 dark:bg-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]' : ''}`}
                                        style={{ width: col.width }}
                                    >
                                        <div className={`relative ${col.hasDropdown ? 'filter-dropdown-container' : ''}`}>
                                            <input
                                                type="text"
                                                value={columnFilters[col.key] || ''}
                                                onChange={(e) => handleColumnFilterChange(col.key, e.target.value)}
                                                onFocus={() => col.hasDropdown && setOpenDropdown(col.key)}
                                                placeholder="필터..."
                                                className={`w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-600 dark:border-slate-500 dark:text-white dark:placeholder-slate-400 ${col.hasDropdown ? 'pr-6' : ''}`}
                                            />
                                            {col.hasDropdown && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setOpenDropdown(openDropdown === col.key ? null : col.key)
                                                    }
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                                >
                                                    <svg
                                                        className="w-3 h-3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M19 9l-7 7-7-7"
                                                        />
                                                    </svg>
                                                </button>
                                            )}
                                            {col.hasDropdown &&
                                                openDropdown === col.key &&
                                                (() => {
                                                    const options = getUniqueValuesForColumn(col.key);
                                                    const filteredOptions = options.filter(
                                                        (v) =>
                                                            !columnFilters[col.key] ||
                                                            String(v)
                                                                .toLowerCase()
                                                                .includes(columnFilters[col.key].toLowerCase())
                                                    );
                                                    return (
                                                        options.length > 0 && (
                                                            <div className="absolute left-0 top-full mt-1 w-48 max-h-48 overflow-y-auto bg-white border border-slate-300 rounded shadow-lg z-50 dark:bg-slate-700 dark:border-slate-600">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleColumnFilterChange(col.key, '');
                                                                        setOpenDropdown(null);
                                                                    }}
                                                                    className="w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-600"
                                                                >
                                                                    (전체)
                                                                </button>
                                                                {filteredOptions.map((value) => (
                                                                    <button
                                                                        key={value}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleColumnFilterChange(col.key, String(value));
                                                                            setOpenDropdown(null);
                                                                        }}
                                                                        className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-600"
                                                                    >
                                                                        {value}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )
                                                    );
                                                })()}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                            {sortedData.length > 0 ? (
                                sortedData.map((row, idx) => (
                                    <tr
                                        key={`${row.symbol}-${idx}`}
                                        className={`hover:bg-blue-50 cursor-pointer transition-colors dark:hover:bg-slate-700 ${selectedRows.has(row.symbol) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
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
                                        {/* 행별 체크박스 - 클릭 시 선택만 */}
                                        <td
                                            className="px-3 py-3 text-center w-[50px] cursor-pointer sticky left-0 z-[5] bg-white dark:bg-slate-800"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectRow(row.symbol, !selectedRows.has(row.symbol));
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.has(row.symbol)}
                                                onChange={() => { }}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-none"
                                            />
                                        </td>
                                        {TABLE_COLUMNS.map((col) => {
                                            const value = row[col.key];
                                            const tooltipHandlers = {
                                                onMouseEnter: handleTooltipEnter,
                                                onMouseLeave: handleTooltipLeave,
                                            };
                                            const displayValue = col.render
                                                ? col.render(value, row, tooltipHandlers)
                                                : value ?? '-';

                                            // 심볼 컬럼은 클릭 시 선택만
                                            const isSymbolCol = col.key === 'symbol';

                                            return (
                                                <td
                                                    key={col.key}
                                                    className={`${col.cellClassName} ${col.sticky ? 'sticky left-[50px] z-[5] bg-white dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''} ${isSymbolCol ? 'cursor-pointer' : ''}`}
                                                    style={{ width: col.width }}
                                                    onClick={isSymbolCol ? (e) => {
                                                        e.stopPropagation();
                                                        handleSelectRow(row.symbol, !selectedRows.has(row.symbol));
                                                    } : undefined}
                                                >
                                                    {displayValue}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="px-4 py-12 text-center" colSpan={TABLE_COLUMNS.length + 1}>
                                        <div className="flex flex-col items-center gap-3">
                                            <svg
                                                className="w-12 h-12 text-slate-300 dark:text-slate-600"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={1.5}
                                                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {isLoading ? '데이터를 불러오는 중입니다...' : '조회된 데이터가 없습니다.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Alert 모달 */}
            <AlertModal open={alertConfig.open} message={alertConfig.message} onClose={handleCloseAlert} />

            {/* 상세정보 모달 */}
            <DetailInfoModal
                isOpen={detailModal.open}
                data={detailModal.data}
                onClose={() => setDetailModal({ open: false, data: null })}
                onAnalyze={handleAnalyze}
                isAnalyzing={isLoading}
            />

            {/* 기업가치 계산 결과 모달 */}
            <CompanyValueResultModal
                isOpen={showValueModal}
                onClose={() => setShowValueModal(false)}
                data={compValueData}
            />

            {/* 추천기업 조회 스케줄 모달 (슈퍼관리자 전용) */}
            {renderScheduleModal && (
                <>
                    <div className={`fixed inset-0 z-[70] bg-black/50 dark:bg-black/70 animate__animated ${isScheduleModalClosing ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }} onClick={() => setShowScheduleModal(false)} />
                    <div
                        className={`fixed z-[80] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(360px,calc(100vw-32px))] rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-800 animate__animated ${isScheduleModalClosing ? 'animate__zoomOut' : 'animate__zoomIn'}`} style={{ animationDuration: '0.25s' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">추천기업 조회 실행</h3>
                        <div className="mb-4">
                            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">
                                조회 건수 (maxCount)
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={maxCountInput}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // 숫자만 허용 (빈 문자열도 허용)
                                    if (val === '' || /^\d+$/.test(val)) {
                                        setMaxCountInput(val);
                                    }
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                placeholder="숫자를 입력하세요 (0 = 전체 조회)"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                0: 전체 조회 / 그 외: 테스트용 (지정 건수만큼 조회)
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowScheduleModal(false);
                                    setMaxCountInput('');
                                }}
                                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleRunSchedule}
                                disabled={!isMaxCountValid}
                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                실행
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* 프로파일 설정 모달 */}
            <ProfileSettingModal
                isOpen={showProfileSettingModal}
                onClose={() => {
                    setShowProfileSettingModal(false);
                    setSelectedProfileForEdit(null);
                    setIsEditMode(false);
                    setEditFormData(null);
                }}
                profiles={allProfiles}
                onRefresh={() => {
                    fetchAllProfiles();
                    fetchProfiles(); // 활성 프로파일 목록도 갱신
                }}
                openAlert={openAlert}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                send={send}
                filterOptions={filterOptions}
                filterOptionsLoading={filterOptionsLoading}
            />

            {/* 커스텀 툴팁 */}
            {tooltip.visible && (
                <div
                    className="fixed z-[9999] px-2 py-1 text-xs bg-slate-800 text-white rounded shadow-lg whitespace-nowrap pointer-events-none"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                        transform: 'translateY(-50%)',
                    }}
                >
                    {tooltip.text}
                </div>
            )}
        </>
    );
};

/**
 * 상세정보 모달 컴포넌트
 */
const DetailInfoModal = ({ isOpen, data, onClose, onAnalyze, isAnalyzing }) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 250);
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

    if (!shouldRender || !data) return null;

    // 모달에 표시할 데이터 필드들 (순서 지정)
    const displayOrder = [
        'symbol',
        'companyName',
        'marketCap',
        'sector',
        'industry',
        'beta',
        'price',
        'lastAnnualDividend',
        'volume',
        'exchange',
        'exchangeShortName',
        'country',
        'peRatioTTM',
        'priceToBookRatioTTM',
        'returnOnEquityTTM',
        'debtEquityRatioTTM',
        'dividendYieldTTM',
        'currentRatioTTM',
        'netProfitMarginTTM',
        'operatingProfitMarginTTM',
        'returnOnAssetsTTM',
        'priceToSalesRatioTTM',
        'enterpriseValueMultipleTTM',
        'trscDt',
        'trscTm',
    ];

    // 데이터 정렬 (displayOrder 순서대로, 나머지는 뒤에)
    const sortedEntries = Object.entries(data).sort(([keyA], [keyB]) => {
        const indexA = displayOrder.indexOf(keyA);
        const indexB = displayOrder.indexOf(keyB);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    return (
        <>
            {/* 배경 오버레이 */}
            <div className={`fixed inset-0 bg-black/50 dark:bg-black/70 z-40 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }} onClick={onClose} />

            {/* 모달 */}
            <div
                ref={modalRef}
                className={`fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white shadow-xl rounded-lg max-h-[85vh] w-[min(700px,90vw)] overflow-hidden dark:bg-slate-800 animate__animated ${isAnimatingOut ? 'animate__zoomOut' : 'animate__zoomIn'}`} style={{ animationDuration: '0.25s' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b bg-white z-10 dark:bg-slate-800 dark:border-slate-700">
                    <div>
                        <h2 className="text-lg font-semibold dark:text-white">기업 상세정보</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {data.symbol} - {data.companyName}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                            onClick={() => onAnalyze(data.symbol)}
                            disabled={isAnalyzing}
                        >
                            {isAnalyzing && (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {isAnalyzing ? '분석 중...' : '분석'}
                        </button>
                        <button
                            className="text-sm px-2 py-1 border rounded hover:bg-gray-50 transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            onClick={onClose}
                        >
                            닫기 (Esc)
                        </button>
                    </div>
                </div>

                {/* 콘텐츠 */}
                <div className="p-4 overflow-y-auto max-h-[calc(85vh-60px)]">
                    {/* 주요 정보 하이라이트 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <HighlightCard label="심볼" value={data.symbol} />
                        <HighlightCard label="주가" value={`$${data.price?.toFixed(2) ?? '-'}`} />
                        <HighlightCard
                            label="시가총액"
                            value={data.marketCap ? `$${(data.marketCap / 1e9).toFixed(2)}B` : '-'}
                        />
                        <HighlightCard label="베타" value={data.beta?.toFixed(3) ?? '-'} />
                    </div>

                    {/* 전체 데이터 그리드 */}
                    <div className="rounded-lg border bg-slate-50 dark:bg-slate-700 dark:border-slate-600 p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                            {sortedEntries.map(([key, value]) => (
                                <div
                                    key={key}
                                    className="flex items-start justify-between gap-3 border-b last:border-b-0 py-1.5 dark:border-slate-600"
                                >
                                    <div className="text-slate-500 whitespace-nowrap dark:text-slate-400">
                                        {FIELD_LABELS[key] || key}
                                    </div>
                                    <div className="text-right break-all font-medium dark:text-slate-200">
                                        {formatFieldValue(key, value)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

/**
 * 하이라이트 카드 컴포넌트
 */
const HighlightCard = ({ label, value }) => (
    <div className="rounded-lg border bg-white p-3 shadow-sm dark:bg-slate-700 dark:border-slate-600">
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white truncate">{value}</div>
    </div>
);

/**
 * 프로파일 설정 모달 컴포넌트
 */
// 신규 프로파일 섹터 쿼터 기본값 (%) - 한 섹터가 결과의 30%를 초과하지 않도록 제한
const DEFAULT_SECTOR_QUOTA_PCT = 30;

const ProfileSettingModal = ({ isOpen, onClose, profiles, onRefresh, openAlert, isLoading, setIsLoading, send, filterOptions, filterOptionsLoading }) => {
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 250);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState(null);
    const [deleteConfirmConfig, setDeleteConfirmConfig] = useState({ open: false, profileName: '' });

    // 초기 폼 데이터 (등록 시)
    const getInitialFormData = () => ({
        profileName: '',
        profileDesc: '',
        isActive: 'Y',
        sortOrder: 1,
        marketCapMin: '',
        marketCapMax: '',
        betaMin: '',
        betaMax: '',
        volumeMin: '',
        volumeMax: '',
        priceMin: '',
        priceMax: '',
        isEtf: 'N',
        isFund: 'N',
        isActivelyTrading: 'Y',
        excludeNonCommonStock: 'Y',
        sectorQuotaPct: DEFAULT_SECTOR_QUOTA_PCT,
        exchange: ['NASDAQ', 'NYSE'],
        sector: [],
        industry: [],
        country: [],
        screenerLimit: 10000,
        peRatioMin: '',
        peRatioMax: '',
        pbRatioMin: '',
        pbRatioMax: '',
        roeMin: '',
        roeMax: '',
        debtEquityMin: '',
        debtEquityMax: '',
        revenueGrowthMin: '',
        revenueGrowthMax: '',
        netIncomeGrowthMin: '',
        netIncomeGrowthMax: '',
        marketCapEnabled: false,
        priceEnabled: false,
        betaEnabled: false,
        volumeEnabled: false,
        peRatioEnabled: false,
        pbRatioEnabled: false,
        roeEnabled: false,
        debtEquityEnabled: false,
        revenueGrowthEnabled: false,
        netIncomeGrowthEnabled: false,
    });

    // 프로파일 선택 시
    const handleSelectProfile = (profile) => {
        setSelectedProfile(profile);
        // 콤마로 구분된 문자열을 배열로 변환
        const splitToArray = (str) => str ? str.split(',').map(s => s.trim()).filter(s => s) : [];

        const hasValue = (v) => v !== null && v !== undefined && v !== '';
        const formDataWithArrays = {
            ...profile,
            excludeNonCommonStock: profile.excludeNonCommonStock || 'Y',
            exchange: splitToArray(profile.exchange),
            sector: splitToArray(profile.sector),
            industry: splitToArray(profile.industry),
            country: splitToArray(profile.country),
            marketCapEnabled: hasValue(profile.marketCapMin) || hasValue(profile.marketCapMax),
            priceEnabled: hasValue(profile.priceMin) || hasValue(profile.priceMax),
            betaEnabled: hasValue(profile.betaMin) || hasValue(profile.betaMax),
            volumeEnabled: hasValue(profile.volumeMin) || hasValue(profile.volumeMax),
            peRatioEnabled: hasValue(profile.peRatioMin) || hasValue(profile.peRatioMax),
            pbRatioEnabled: hasValue(profile.pbRatioMin) || hasValue(profile.pbRatioMax),
            roeEnabled: hasValue(profile.roeMin) || hasValue(profile.roeMax),
            debtEquityEnabled: hasValue(profile.debtEquityMin) || hasValue(profile.debtEquityMax),
            revenueGrowthEnabled: hasValue(profile.revenueGrowthMin) || hasValue(profile.revenueGrowthMax),
            netIncomeGrowthEnabled: hasValue(profile.netIncomeGrowthMin) || hasValue(profile.netIncomeGrowthMax),
        };
        setFormData(formDataWithArrays);
        setIsCreating(false);
    };

    // 등록 버튼 클릭
    const handleCreateNew = () => {
        setIsCreating(true);
        setSelectedProfile(null);
        setFormData(getInitialFormData());
    };

    // 프로파일명 중복 확인 및 번호 증가
    const getUniqueProfileName = (baseName) => {
        const existingNames = profiles.map(p => p.profileName);

        // 기본 복사 이름 생성
        let newName = `${baseName}_복사1`;
        let counter = 1;

        // 중복이 없을 때까지 번호 증가
        while (existingNames.includes(newName)) {
            counter++;
            newName = `${baseName}_복사${counter}`;
        }

        return newName;
    };

    // 프로파일 복사 (즉시 저장)
    const handleCopyProfile = async (profile, e) => {
        // 이벤트 버블링 방지 (프로파일 선택 이벤트와 분리)
        e?.stopPropagation();

        if (!profile) return;

        setIsLoading(true);
        try {
            // 고유한 프로파일명 생성
            const newProfileName = getUniqueProfileName(profile.profileName);

            // 복사할 데이터 생성 (id 제외)
            const copiedData = {
                ...profile,
                id: undefined, // 새로 생성되어야 하므로 id 제거
                profileName: newProfileName,
            };

            // 서버에 등록 요청
            const { data, error } = await send('/dart/recommend/profile/regi', copiedData, 'POST');

            if (!error) {
                openAlert(`프로파일이 복사되었습니다.\n새 프로파일명: ${newProfileName}`);
                onRefresh(); // 목록 갱신
            } else {
                openAlert(data?.message || '복사 중 오류가 발생했습니다.');
            }
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 폼 필드 변경
    const handleFormChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // 저장 (등록 또는 수정)
    const handleSave = async () => {
        if (!formData) return;

        // 필수 필드 검증
        if (!formData.profileName?.trim()) {
            openAlert('프로파일명은 필수 입력 항목입니다.');
            return;
        }
        if (formData.screenerLimit === '' || formData.screenerLimit === null || formData.screenerLimit === undefined) {
            openAlert('스크리너 조회 제한 건수를 입력해주세요.');
            return;
        }

        setIsLoading(true);
        try {
            // 배열을 콤마로 구분된 문자열로 변환
            const arrayToString = (arr) => Array.isArray(arr) ? arr.join(',') : arr;

            const dataToSend = {
                ...formData,
                exchange: arrayToString(formData.exchange),
                sector: arrayToString(formData.sector),
                industry: arrayToString(formData.industry),
                country: arrayToString(formData.country),
                // 비활성 지표는 null 전달 (백엔드에서 필터링 생략)
                marketCapMin: formData.marketCapEnabled ? formData.marketCapMin : null,
                marketCapMax: formData.marketCapEnabled ? formData.marketCapMax : null,
                priceMin: formData.priceEnabled ? formData.priceMin : null,
                priceMax: formData.priceEnabled ? formData.priceMax : null,
                betaMin: formData.betaEnabled ? formData.betaMin : null,
                betaMax: formData.betaEnabled ? formData.betaMax : null,
                volumeMin: formData.volumeEnabled ? formData.volumeMin : null,
                volumeMax: formData.volumeEnabled ? formData.volumeMax : null,
                peRatioMin: formData.peRatioEnabled ? formData.peRatioMin : null,
                peRatioMax: formData.peRatioEnabled ? formData.peRatioMax : null,
                pbRatioMin: formData.pbRatioEnabled ? formData.pbRatioMin : null,
                pbRatioMax: formData.pbRatioEnabled ? formData.pbRatioMax : null,
                roeMin: formData.roeEnabled ? formData.roeMin : null,
                roeMax: formData.roeEnabled ? formData.roeMax : null,
                debtEquityMin: formData.debtEquityEnabled ? formData.debtEquityMin : null,
                debtEquityMax: formData.debtEquityEnabled ? formData.debtEquityMax : null,
                revenueGrowthMin: formData.revenueGrowthEnabled ? formData.revenueGrowthMin : null,
                revenueGrowthMax: formData.revenueGrowthEnabled ? formData.revenueGrowthMax : null,
                netIncomeGrowthMin: formData.netIncomeGrowthEnabled ? formData.netIncomeGrowthMin : null,
                netIncomeGrowthMax: formData.netIncomeGrowthEnabled ? formData.netIncomeGrowthMax : null,
                // 섹터 쿼터: 빈 값이면 null (미적용)
                sectorQuotaPct: formData.sectorQuotaPct === '' ? null : formData.sectorQuotaPct,
            };
            // enabled 상태 필드는 백엔드에 보내지 않음
            delete dataToSend.marketCapEnabled;
            delete dataToSend.priceEnabled;
            delete dataToSend.betaEnabled;
            delete dataToSend.volumeEnabled;
            delete dataToSend.peRatioEnabled;
            delete dataToSend.pbRatioEnabled;
            delete dataToSend.roeEnabled;
            delete dataToSend.debtEquityEnabled;
            delete dataToSend.revenueGrowthEnabled;
            delete dataToSend.netIncomeGrowthEnabled;

            const endpoint = isCreating ? '/dart/recommend/profile/regi' : '/dart/recommend/profile/modi';
            const { data, error } = await send(endpoint, dataToSend, 'POST');

            if (!error) {
                openAlert(isCreating ? '프로파일이 등록되었습니다.' : '프로파일이 수정되었습니다.');
                onRefresh();
                setIsCreating(false);
                setSelectedProfile(null);
                setFormData(null);
            } else {
                openAlert(data?.message || '처리 중 오류가 발생했습니다.');
            }
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 삭제 확인 모달 열기
    const handleDeleteClick = () => {
        if (!selectedProfile?.id) return;
        setDeleteConfirmConfig({
            open: true,
            profileName: selectedProfile.profileName
        });
    };

    // 삭제 실행
    const handleDeleteConfirm = async () => {
        if (!selectedProfile?.id) return;

        setDeleteConfirmConfig({ open: false, profileName: '' });
        setIsLoading(true);
        try {
            const { data, error } = await send('/dart/recommend/profile/del', { id: selectedProfile.id }, 'POST');

            if (!error) {
                openAlert('프로파일이 삭제되었습니다.');
                onRefresh();
                setSelectedProfile(null);
                setFormData(null);
            } else {
                openAlert(data?.message || '삭제 중 오류가 발생했습니다.');
            }
        } catch (e) {
            openAlert('요청 처리 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!shouldRender) return null;

    return (
        <>
            {/* 배경 오버레이 */}
            <div className={`fixed inset-0 z-[70] bg-black/50 dark:bg-black/70 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }} onClick={onClose} />

            {/* 모달 */}
            <div
                className={`fixed z-[80] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[98vw] md:w-[min(95vw,1200px)] max-h-[95vh] md:max-h-[90vh] rounded-lg md:rounded-xl bg-white shadow-2xl dark:bg-slate-800 flex flex-col animate__animated ${isAnimatingOut ? 'animate__zoomOut' : 'animate__zoomIn'}`} style={{ animationDuration: '0.25s' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white">프로파일 설정</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* 왼쪽: 프로파일 목록 */}
                    <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 overflow-y-auto max-h-[40vh] md:max-h-none bg-slate-100/50 dark:bg-black/20">
                        <div className="p-3 md:p-4">
                            <button
                                onClick={handleCreateNew}
                                disabled={isLoading}
                                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                            >
                                + 새 프로파일 등록
                            </button>
                            <div className="space-y-2">
                                {profiles.map((profile) => (
                                    <div
                                        key={profile.id}
                                        className={`relative rounded-lg transition-colors ${selectedProfile?.id === profile.id
                                                ? 'bg-blue-50 border-2 border-blue-500 dark:bg-blue-900/30 dark:border-blue-400'
                                                : 'bg-slate-50 border border-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600'
                                            } ${profile.isActive !== 'Y' ? 'opacity-50' : ''}`}
                                    >
                                        <button
                                            onClick={() => handleSelectProfile(profile)}
                                            className="w-full px-4 py-3 pr-12 text-left"
                                        >
                                            <div className={`font-medium ${profile.isActive !== 'Y' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>{profile.profileName}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                {profile.isActive === 'Y' ? '활성' : <span className="text-red-400">비활성</span>} | 정렬순서: {profile.sortOrder}
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => handleCopyProfile(profile, e)}
                                            disabled={isLoading}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="프로파일 복사"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 오른쪽: 프로파일 상세/수정 폼 */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6">
                        {formData ? (
                            <ProfileForm
                                formData={formData}
                                onChange={handleFormChange}
                                isCreating={isCreating}
                                onSave={handleSave}
                                onDelete={handleDeleteClick}
                                onCancel={() => {
                                    setFormData(null);
                                    setSelectedProfile(null);
                                    setIsCreating(false);
                                }}
                                isLoading={isLoading}
                                filterOptions={filterOptions}
                                filterOptionsLoading={filterOptionsLoading}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                                프로파일을 선택하거나 새로 등록하세요
                            </div>
                        )}
                    </div>
                </div>

                {/* 삭제 확인 모달 */}
                <AlertModal
                    open={deleteConfirmConfig.open}
                    title="삭제 확인"
                    message={`'${deleteConfirmConfig.profileName}' 프로파일을 삭제하시겠습니까?`}
                    onClose={() => setDeleteConfirmConfig({ open: false, profileName: '' })}
                    onConfirm={handleDeleteConfirm}
                />
            </div>
        </>
    );
};
/**
 * 프로파일 입력 폼 컴포넌트
 */
// 숫자를 한글 단위로 변환 (슬라이더 표시용)
const formatKoreanNumber = (num) => {
    if (num === null || num === undefined || num === '' || isNaN(num)) return '0';
    const number = Number(num);
    if (number === 0) return '0';

    const units = [
        { unit: '조', value: 1000000000000 },
        { unit: '억', value: 100000000 },
        { unit: '만', value: 10000 },
    ];

    const result = [];
    let remaining = Math.abs(number);

    for (const { unit, value } of units) {
        const count = Math.floor(remaining / value);
        if (count > 0) {
            result.push(`${count.toLocaleString()}${unit}`);
            remaining = remaining % value;
        }
    }

    if (remaining > 0 || result.length === 0) {
        result.push(remaining.toLocaleString());
    }

    return (number < 0 ? '-' : '') + result.join(' ');
};

const ProfileForm = ({ formData, onChange, isCreating, onSave, onDelete, onCancel, isLoading, filterOptions, filterOptionsLoading }) => {
    return (
        <div className="space-y-4 md:space-y-6">
            {/* 프로파일 기본 정보 */}
            <section>
                <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    프로파일 기본 정보
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <FormInput
                        label="프로파일명 (profileName)"
                        value={formData.profileName}
                        onChange={(v) => onChange('profileName', v)}
                        placeholder="예: 가치투자형"
                        required
                    />
                    <FormInput
                        label="프로파일 설명 (profileDesc)"
                        value={formData.profileDesc}
                        onChange={(v) => onChange('profileDesc', v)}
                        placeholder="예: 저평가 가치주 중심"
                    />
                    <FormToggleSwitch
                        label="활성여부 (isActive)"
                        value={formData.isActive}
                        onChange={(v) => onChange('isActive', v)}
                    />
                    <FormNumberStepper
                        label="정렬순서 (sortOrder)"
                        value={formData.sortOrder}
                        onChange={(v) => onChange('sortOrder', v)}
                        min={1}
                        max={99}
                        required
                    />
                </div>
            </section>

            {/* Stock Screener 조건 */}
            <section>
                <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    Stock Screener 조건
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <DualRangeSlider
                        label="시가총액"
                        description="Market Cap (USD)"
                        min={0}
                        max={5000000000000}
                        step={1000000000}
                        valueMin={formData.marketCapMin}
                        valueMax={formData.marketCapMax}
                        onChangeMin={(v) => onChange('marketCapMin', v)}
                        onChangeMax={(v) => onChange('marketCapMax', v)}
                        enabled={formData.marketCapEnabled}
                        onToggle={() => onChange('marketCapEnabled', !formData.marketCapEnabled)}
                        formatDisplay={formatKoreanNumber}
                    />
                    <DualRangeSlider
                        label="주가"
                        description="Price (USD)"
                        min={0}
                        max={1000000}
                        step={100}
                        valueMin={formData.priceMin}
                        valueMax={formData.priceMax}
                        onChangeMin={(v) => onChange('priceMin', v)}
                        onChangeMax={(v) => onChange('priceMax', v)}
                        enabled={formData.priceEnabled}
                        onToggle={() => onChange('priceEnabled', !formData.priceEnabled)}
                        formatDisplay={formatKoreanNumber}
                    />
                    <DualRangeSlider
                        label="베타"
                        description="Beta"
                        min={0}
                        max={5}
                        step={0.01}
                        valueMin={formData.betaMin}
                        valueMax={formData.betaMax}
                        onChangeMin={(v) => onChange('betaMin', v)}
                        onChangeMax={(v) => onChange('betaMax', v)}
                        enabled={formData.betaEnabled}
                        onToggle={() => onChange('betaEnabled', !formData.betaEnabled)}
                    />
                    <DualRangeSlider
                        label="거래량"
                        description="Volume"
                        min={0}
                        max={100000000}
                        step={10000}
                        valueMin={formData.volumeMin}
                        valueMax={formData.volumeMax}
                        onChangeMin={(v) => onChange('volumeMin', v)}
                        onChangeMax={(v) => onChange('volumeMax', v)}
                        enabled={formData.volumeEnabled}
                        onToggle={() => onChange('volumeEnabled', !formData.volumeEnabled)}
                        formatDisplay={formatKoreanNumber}
                    />
                    <FormToggleSwitch
                        label="ETF 포함여부 (isEtf)"
                        value={formData.isEtf}
                        onChange={(v) => onChange('isEtf', v)}
                        labelOn="포함"
                        labelOff="제외"
                    />
                    <FormToggleSwitch
                        label="펀드 포함여부 (isFund)"
                        value={formData.isFund}
                        onChange={(v) => onChange('isFund', v)}
                        labelOn="포함"
                        labelOff="제외"
                    />
                    <FormToggleSwitch
                        label="활성거래 종목만 (isActivelyTrading)"
                        value={formData.isActivelyTrading}
                        onChange={(v) => onChange('isActivelyTrading', v)}
                        labelOn="활성거래만"
                        labelOff="전체"
                    />
                    <FormToggleSwitch
                        label="비일반주식 제외 (excludeNonCommonStock)"
                        value={formData.excludeNonCommonStock}
                        onChange={(v) => onChange('excludeNonCommonStock', v)}
                        labelOn="제외 (워런트/우선주/CVR/채권)"
                        labelOff="포함"
                    />
                    <FormMultiSelect
                        label="국가 (country)"
                        value={formData.country || []}
                        onChange={(v) => onChange('country', v)}
                        options={filterOptions?.countries || []}
                        loading={filterOptionsLoading?.countries}
                        placeholder="국가 선택"
                    />
                    <FormMultiSelect
                        label="거래소 (exchange)"
                        value={formData.exchange || []}
                        onChange={(v) => onChange('exchange', v)}
                        options={filterOptions?.exchanges || []}
                        loading={filterOptionsLoading?.exchanges}
                        placeholder="거래소 선택"
                        required
                    />
                    <FormMultiSelect
                        label="섹터 (sector)"
                        value={formData.sector || []}
                        onChange={(v) => onChange('sector', v)}
                        options={filterOptions?.sectors || []}
                        loading={filterOptionsLoading?.sectors}
                        placeholder="섹터 선택"
                    />
                    <FormMultiSelect
                        label="산업군 (industry)"
                        value={formData.industry || []}
                        onChange={(v) => onChange('industry', v)}
                        options={filterOptions?.industries || []}
                        loading={filterOptionsLoading?.industries}
                        placeholder="산업군 선택"
                    />
                    <FormInput
                        label="스크리너 조회 제한 건수 (screenerLimit)"
                        type="number"
                        value={formData.screenerLimit}
                        onChange={(v) => onChange('screenerLimit', v)}
                        placeholder="10000"
                        required
                    />
                    <FormInput
                        label="섹터 쿼터 % (sectorQuotaPct)"
                        type="number"
                        value={formData.sectorQuotaPct}
                        onChange={(v) => onChange('sectorQuotaPct', v)}
                        placeholder="30 (빈 값 = 미적용, 한 섹터가 결과에서 차지하는 비중 상한)"
                    />
                </div>
            </section>

            {/* 저평가 필터링 조건 */}
            <section>
                <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    저평가 필터링 조건
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <DualRangeSlider
                        label="PER"
                        description="주가수익비율 (15 = 이익의 15배)"
                        min={0}
                        max={100}
                        step={0.5}
                        valueMin={formData.peRatioMin}
                        valueMax={formData.peRatioMax}
                        onChangeMin={(v) => onChange('peRatioMin', v)}
                        onChangeMax={(v) => onChange('peRatioMax', v)}
                        enabled={formData.peRatioEnabled}
                        onToggle={() => onChange('peRatioEnabled', !formData.peRatioEnabled)}
                    />
                    <DualRangeSlider
                        label="PBR"
                        description="주가순자산비율 (2.5 = 순자산의 2.5배)"
                        min={0}
                        max={10}
                        step={0.1}
                        valueMin={formData.pbRatioMin}
                        valueMax={formData.pbRatioMax}
                        onChangeMin={(v) => onChange('pbRatioMin', v)}
                        onChangeMax={(v) => onChange('pbRatioMax', v)}
                        enabled={formData.pbRatioEnabled}
                        onToggle={() => onChange('pbRatioEnabled', !formData.pbRatioEnabled)}
                    />
                    <DualRangeSlider
                        label="ROE"
                        description="자기자본이익률 (0.1 = 10%)"
                        min={0}
                        max={1.0}
                        step={0.01}
                        valueMin={formData.roeMin}
                        valueMax={formData.roeMax}
                        onChangeMin={(v) => onChange('roeMin', v)}
                        onChangeMax={(v) => onChange('roeMax', v)}
                        enabled={formData.roeEnabled}
                        onToggle={() => onChange('roeEnabled', !formData.roeEnabled)}
                    />
                    <DualRangeSlider
                        label="부채비율"
                        description="D/E Ratio (1.5 = 자기자본 대비 부채 150%)"
                        min={0}
                        max={5.0}
                        step={0.1}
                        valueMin={formData.debtEquityMin}
                        valueMax={formData.debtEquityMax}
                        onChangeMin={(v) => onChange('debtEquityMin', v)}
                        onChangeMax={(v) => onChange('debtEquityMax', v)}
                        enabled={formData.debtEquityEnabled}
                        onToggle={() => onChange('debtEquityEnabled', !formData.debtEquityEnabled)}
                    />
                </div>
            </section>

            {/* 성장률 필터링 조건 */}
            <section>
                <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    성장률 필터링 조건
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <DualRangeSlider
                        label="매출 성장률 (3Y 평균)"
                        description="연평균 매출 증감률 (0.10 = 10%)"
                        min={-1.0}
                        max={5.0}
                        step={0.01}
                        valueMin={formData.revenueGrowthMin}
                        valueMax={formData.revenueGrowthMax}
                        onChangeMin={(v) => onChange('revenueGrowthMin', v)}
                        onChangeMax={(v) => onChange('revenueGrowthMax', v)}
                        enabled={formData.revenueGrowthEnabled}
                        onToggle={() => onChange('revenueGrowthEnabled', !formData.revenueGrowthEnabled)}
                    />
                    <DualRangeSlider
                        label="순이익 성장률 (3Y 평균)"
                        description="연평균 순이익 증감률 (0.20 = 20%)"
                        min={-1.0}
                        max={5.0}
                        step={0.01}
                        valueMin={formData.netIncomeGrowthMin}
                        valueMax={formData.netIncomeGrowthMax}
                        onChangeMin={(v) => onChange('netIncomeGrowthMin', v)}
                        onChangeMax={(v) => onChange('netIncomeGrowthMax', v)}
                        enabled={formData.netIncomeGrowthEnabled}
                        onToggle={() => onChange('netIncomeGrowthEnabled', !formData.netIncomeGrowthEnabled)}
                    />
                </div>
            </section>

            {/* 버튼 */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                <div>
                    {!isCreating && (
                        <button
                            onClick={onDelete}
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            삭제
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                        취소
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCreating ? '등록' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * 폼 입력 컴포넌트
 */
const FormInput = ({ label, value, onChange, type = 'text', placeholder, required, step }) => {
    // 숫자를 한글 단위로 변환
    const formatNumberToKorean = (num) => {
        if (!num || isNaN(num)) return '';

        const number = Number(num);
        const units = [
            { unit: '조', value: 1000000000000 },
            { unit: '억', value: 100000000 },
            { unit: '만', value: 10000 },
        ];

        const result = [];
        let remaining = Math.abs(number);

        for (const { unit, value } of units) {
            const count = Math.floor(remaining / value);
            if (count > 0) {
                result.push(`${count.toLocaleString()}${unit}`);
                remaining = remaining % value;
            }
        }

        if (remaining > 0 || result.length === 0) {
            result.push(remaining.toLocaleString());
        }

        return result.join(' ') + (number < 0 ? ' (음수)' : '');
    };

    // type이 number이고 큰 금액 필드인지 확인
    const isLargeNumberField = type === 'number' && (
        label.includes('시가총액') ||
        label.includes('거래량') ||
        label.includes('screenerLimit')
    );

    const koreanValue = isLargeNumberField ? formatNumberToKorean(value) : '';

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type === 'number' ? 'text' : type}
                value={value === null || value === undefined ? '' : String(value)}
                onChange={(e) => {
                    const val = e.target.value;
                    if (type === 'number') {
                        // 빈 문자열이거나 숫자(소수점, 음수 포함)만 허용
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                            onChange(val === '' ? '' : val);
                        }
                    } else {
                        onChange(val);
                    }
                }}
                onBlur={(e) => {
                    // blur 시 숫자로 변환
                    if (type === 'number' && e.target.value !== '') {
                        const num = parseFloat(e.target.value);
                        onChange(isNaN(num) ? '' : num);
                    }
                }}
                placeholder={placeholder}
                step={step}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            />
            {koreanValue && (
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    {koreanValue}
                </p>
            )}
        </div>
    );
};

/**
 * 폼 셀렉트 컴포넌트
 */
const FormSelect = ({ label, value, onChange, options, required }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    </div>
);

/**
 * 폼 멀티셀렉트 컴포넌트
 */
const FormMultiSelect = ({ label, value, onChange, options, loading, placeholder, required }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <MultiSelect
            value={value || []}
            onChange={onChange}
            options={options || []}
            loading={loading}
            placeholder={placeholder}
            searchable={true}
            showChips={true}
        />
    </div>
);

/**
 * 폼 토글 스위치 컴포넌트 (Y/N 값)
 */
const FormToggleSwitch = ({ label, value, onChange, labelOn = '활성', labelOff = '비활성' }) => {
    const isOn = value === 'Y';
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label}
            </label>
            <button
                type="button"
                role="switch"
                aria-checked={isOn}
                onClick={() => onChange(isOn ? 'N' : 'Y')}
                className={`relative inline-flex h-8 w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                    isOn ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-500'
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isOn ? 'translate-x-8' : 'translate-x-0'
                    }`}
                />
            </button>
            <span className={`ml-2 text-sm font-medium ${isOn ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {isOn ? labelOn : labelOff}
            </span>
        </div>
    );
};

/**
 * 폼 숫자 스테퍼 컴포넌트
 */
const FormNumberStepper = ({ label, value, onChange, min = 1, max = 99, required }) => {
    const numValue = Number(value) || min;
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(min, numValue - 1))}
                    disabled={numValue <= min}
                    className="px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-l-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    −
                </button>
                <span className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-white min-w-[3rem] text-center border-x border-slate-300 dark:border-slate-600">
                    {numValue}
                </span>
                <button
                    type="button"
                    onClick={() => onChange(Math.min(max, numValue + 1))}
                    disabled={numValue >= max}
                    className="px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-r-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    +
                </button>
            </div>
        </div>
    );
};

export default AbroadRecommendedStock;
