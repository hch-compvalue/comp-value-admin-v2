import { useState, useEffect, useRef } from 'react';
import useLogStream, { MAX_LOGS, POLLING_INTERVAL } from './useLogStream';

/**
 * 로그 소스별 설정 (제목·수신방식·엔드포인트·강조색)
 * - Tailwind는 동적 클래스 조합을 인식하지 못하므로 색상 클래스는 문자열 그대로 둔다
 */
const LOG_SOURCES = {
    app: {
        title: 'CompValue App 로그',
        mode: 'sse',
        endpoint: '/dart/mgnt/stream',
        headerClass: 'from-blue-500 to-indigo-600',
        accentButtonClass: 'bg-indigo-600 hover:bg-indigo-700',
        accentRingClass: 'focus:ring-indigo-500',
        accentCheckClass: 'text-indigo-600 focus:ring-indigo-500',
        currentResultClass: 'bg-indigo-900/50 dark:bg-indigo-900/70 ring-2 ring-indigo-500',
    },
    ml: {
        title: '주식 예측 프로그램 실시간 로그',
        mode: 'polling',
        endpoint: '/dart/ml/logs/stream/latest',
        headerClass: 'from-indigo-500 to-purple-600',
        accentButtonClass: 'bg-indigo-600 hover:bg-indigo-700',
        accentRingClass: 'focus:ring-indigo-500',
        accentCheckClass: 'text-indigo-600 focus:ring-indigo-500',
        currentResultClass: 'bg-indigo-900/50 dark:bg-indigo-900/70 ring-2 ring-indigo-500',
    },
    cointrade: {
        title: '코인 자동매매 프로그램 실시간 로그',
        mode: 'polling',
        endpoint: '/dart/api/cointrade/log/logs/stream/latest',
        headerClass: 'from-orange-500 to-red-600',
        accentButtonClass: 'bg-orange-600 hover:bg-orange-700',
        accentRingClass: 'focus:ring-orange-500',
        accentCheckClass: 'text-orange-600 focus:ring-orange-500',
        currentResultClass: 'bg-orange-900/50 dark:bg-orange-900/70 ring-2 ring-orange-500',
    },
};

// 로그 레벨별 글자색 (적록색약 고려: 일반 로그는 초록 대신 밝은 회색)
const getMessageClass = (message) => {
    if (message.includes('[오류]') || message.includes('[ERROR]')) return 'text-red-400 font-semibold';
    if (message.includes('[경고]') || message.includes('[WARN]')) return 'text-yellow-400';
    if (message.includes('[시스템]')) return 'text-cyan-400';
    return 'text-slate-200';
};

/**
 * 실시간 로그 팝업 페이지 (독립 브라우저 창으로 열림)
 * - 검색 기능 (Ctrl+F)
 *
 * @param {keyof LOG_SOURCES} sourceKey - 로그 소스
 */
export default function LogStreamViewer({ sourceKey }) {
    const source = LOG_SOURCES[sourceKey];
    const { logs, isConnected, error, start, stop, clear } = useLogStream(source);
    const [autoScroll, setAutoScroll] = useState(true);

    // 검색 관련 상태
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

    const logContainerRef = useRef(null);
    const searchInputRef = useRef(null);

    // 자동 스크롤 (DOM 업데이트 후 스크롤을 위해 약간의 지연 추가)
    useEffect(() => {
        if (!autoScroll || showSearch) return undefined;
        const timer = setTimeout(() => {
            if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [logs, autoScroll, showSearch]);

    const closeSearch = () => {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
        setCurrentSearchIndex(-1);
    };

    const openSearch = () => {
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    // Ctrl+F 키보드 단축키, ESC로 검색 닫기
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                openSearch();
            }
            if (e.key === 'Escape' && showSearch) closeSearch();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showSearch]);

    // 검색 결과로 스크롤
    const scrollToSearchResult = (results, resultIndex) => {
        if (resultIndex < 0 || resultIndex >= results.length) return;

        const logElement = document.getElementById(`log-${results[resultIndex]}`);
        if (logElement && logContainerRef.current) {
            const containerRect = logContainerRef.current.getBoundingClientRect();
            const elementRect = logElement.getBoundingClientRect();
            const scrollTop = logContainerRef.current.scrollTop;
            const offset = elementRect.top - containerRect.top + scrollTop - containerRect.height / 2;

            logContainerRef.current.scrollTo({ top: offset, behavior: 'smooth' });
        }
    };

    // 검색 실행
    useEffect(() => {
        if (!searchQuery) {
            setSearchResults([]);
            setCurrentSearchIndex(-1);
            return;
        }

        const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
        const results = [];
        logs.forEach((log, index) => {
            const logText = `[${log.timestamp}] ${log.message}`;
            const searchText = caseSensitive ? logText : logText.toLowerCase();
            if (searchText.includes(query)) results.push(index);
        });

        setSearchResults(results);
        setCurrentSearchIndex(results.length > 0 ? 0 : -1);

        // 첫 번째 결과로 스크롤
        if (results.length > 0) scrollToSearchResult(results, 0);
    }, [searchQuery, caseSensitive, logs]);

    // 이전/다음 검색 결과
    const moveSearch = (step) => {
        if (searchResults.length === 0) return;
        const newIndex = (currentSearchIndex + step + searchResults.length) % searchResults.length;
        setCurrentSearchIndex(newIndex);
        scrollToSearchResult(searchResults, newIndex);
    };

    const handleClearLogs = () => {
        clear();
        setSearchResults([]);
        setCurrentSearchIndex(-1);
    };

    // 텍스트 하이라이팅
    const highlightText = (text, shouldHighlight) => {
        if (!shouldHighlight || !searchQuery) return text;

        const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
        const searchText = caseSensitive ? text : text.toLowerCase();
        const parts = [];
        let lastIndex = 0;

        let index = searchText.indexOf(query);
        while (index !== -1) {
            // 매칭 전 텍스트
            if (index > lastIndex) parts.push({ text: text.substring(lastIndex, index), highlight: false });
            // 매칭된 텍스트
            parts.push({ text: text.substring(index, index + query.length), highlight: true });
            lastIndex = index + query.length;
            index = searchText.indexOf(query, lastIndex);
        }
        // 나머지 텍스트
        if (lastIndex < text.length) parts.push({ text: text.substring(lastIndex), highlight: false });

        return (
            <>
                {parts.map((part, i) => (
                    part.highlight ? (
                        <mark key={i} className="bg-yellow-400 dark:bg-yellow-600 text-slate-900 dark:text-white px-0.5 rounded">
                            {part.text}
                        </mark>
                    ) : (
                        <span key={i}>{part.text}</span>
                    )
                ))}
            </>
        );
    };

    const footerInfo = source.mode === 'polling'
        ? `Endpoint: GET ${source.endpoint} | Polling: ${POLLING_INTERVAL / 1000}s | Ctrl+F: 검색`
        : `Endpoint: GET ${source.endpoint} | Ctrl+F: 검색`;

    return (
        <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* 헤더 */}
            <div className={`flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r ${source.headerClass} shadow-lg`}>
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-white/80 animate-pulse' : 'bg-white/40'}`}></div>
                    <h1 className="text-base sm:text-lg font-semibold text-white">
                        {source.title}
                    </h1>
                    {/* 연결 상태 (적록색약 고려: 파랑=연결, 노랑=끊김) */}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isConnected
                        ? 'bg-sky-500/30 text-sky-50 border border-sky-200/40'
                        : 'bg-amber-400/30 text-amber-50 border border-amber-200/40'
                        }`}>
                        {isConnected ? '연결됨' : '연결 끊김'}
                    </span>
                </div>
                <button
                    onClick={() => window.close()}
                    className="text-white/80 hover:text-white transition-colors"
                    title="창 닫기"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* 컨트롤 영역 */}
            <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <div className="flex flex-wrap gap-2 items-center justify-between mb-2">
                    <div className="flex gap-2">
                        {!isConnected ? (
                            <button
                                onClick={start}
                                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors shadow-sm"
                            >
                                연결 시작
                            </button>
                        ) : (
                            <button
                                onClick={stop}
                                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors shadow-sm"
                            >
                                연결 종료
                            </button>
                        )}
                        <button
                            onClick={handleClearLogs}
                            className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium transition-colors shadow-sm"
                        >
                            로그 지우기
                        </button>
                        <button
                            onClick={() => (showSearch ? setShowSearch(false) : openSearch())}
                            className={`px-3 py-1.5 rounded-lg ${source.accentButtonClass} text-white text-sm font-medium transition-colors shadow-sm`}
                            title="Ctrl+F"
                        >
                            <svg className="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            검색
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoScroll}
                                onChange={(e) => setAutoScroll(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span>자동 스크롤</span>
                        </label>
                        <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                            {logs.length}/{MAX_LOGS}
                        </span>
                    </div>
                </div>

                {/* 검색 바 */}
                {showSearch && (
                    <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') moveSearch(e.shiftKey ? -1 : 1);
                            }}
                            placeholder="검색어 입력... (Enter: 다음, Shift+Enter: 이전)"
                            className={`flex-1 px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 ${source.accentRingClass}`}
                        />
                        <label className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap">
                            <input
                                type="checkbox"
                                checked={caseSensitive}
                                onChange={(e) => setCaseSensitive(e.target.checked)}
                                className={`w-3.5 h-3.5 rounded focus:ring-2 ${source.accentCheckClass}`}
                            />
                            <span>대소문자</span>
                        </label>
                        <span className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded whitespace-nowrap">
                            {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => moveSearch(-1)}
                                disabled={searchResults.length === 0}
                                className="p-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="이전 (Shift+Enter)"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button
                                onClick={() => moveSearch(1)}
                                disabled={searchResults.length === 0}
                                className="p-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="다음 (Enter)"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                        <button
                            onClick={closeSearch}
                            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                            title="검색 닫기 (ESC)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* 로그 표시 영역 */}
            <div
                ref={logContainerRef}
                className="flex-1 overflow-y-auto p-4 bg-slate-900 dark:bg-black"
                style={{ fontFamily: '"D2Coding", "D2Coding ligature", Consolas, Monaco, "Courier New", monospace' }}
            >
                {error && (
                    <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg">
                        <p className="text-sm text-red-300">[오류] {error}</p>
                    </div>
                )}

                {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-slate-500 text-lg mb-2">로그가 없습니다</p>
                            <p className="text-sm text-slate-600">
                                {isConnected ? '로그를 기다리는 중...' : '연결을 시작하세요'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {logs.map((log, idx) => {
                            const isSearchResult = searchResults.includes(idx);
                            const isCurrentResult = searchResults[currentSearchIndex] === idx;

                            return (
                                <div
                                    key={idx}
                                    id={`log-${idx}`}
                                    className={`text-sm leading-relaxed px-2 py-1 rounded transition-all ${isCurrentResult
                                        ? source.currentResultClass
                                        : isSearchResult
                                            ? 'bg-slate-800/70 dark:bg-slate-900/70'
                                            : 'hover:bg-slate-800 dark:hover:bg-slate-900'
                                        }`}
                                >
                                    <span className="text-slate-500 dark:text-slate-600 mr-2">
                                        {highlightText(`[${log.timestamp}]`, isSearchResult)}
                                    </span>
                                    <span className={getMessageClass(log.message)}>
                                        {highlightText(log.message, isSearchResult)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 푸터 */}
            <div className="px-4 sm:px-6 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>{footerInfo}</span>
                    <span>Max Logs: {MAX_LOGS.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}
