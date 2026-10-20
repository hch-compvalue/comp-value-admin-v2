import { useState, useEffect, useRef } from 'react';
import { send } from '@/util/ClientUtil';
import useModalAnimation from '@/hooks/useModalAnimation';

/**
 * CommonLogManagementModal
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: function
 * - title: string
 * - apiEndpoints: { list: string, content: (filename) => string }
 * - streamUrl: string
 * - windowName: string
 * - theme: 'blue' | 'indigo' | 'orange' | 'green' (default: 'blue') — 2026-10-20 부터 모든 값이 같은 중립 스타일
 */
export default function CommonLogManagementModal({
    isOpen,
    onClose,
    title,
    apiEndpoints,
    streamUrl,
    windowName,
    theme = 'blue'
}) {
    const [activeTab, setActiveTab] = useState('fileList');
    const [fileList, setFileList] = useState([]);
    const [selectedFile, setSelectedFile] = useState('');
    const [logContent, setLogContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [contentLoading, setContentLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [logSearchTerm, setLogSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(-1);
    
    const [showMobileList, setShowMobileList] = useState(true);

    const logSearchInputRef = useRef(null);
    const resultRefs = useRef({});

    // 화면마다 다른 브랜드 색을 쓰지 않도록 모든 theme 이 같은 중립 스타일을 사용 (theme prop 은 호환용으로 유지)
    const neutralTheme = {
        activeTabBg: 'bg-brand',
        focusRing: 'focus:ring-blue-500',
        loaderBorder: 'border-blue-500',
        iconBg: 'bg-blue-50 dark:bg-blue-900/30',
        iconText: 'text-blue-600 dark:text-blue-400',
        streamBtn: 'bg-brand hover:bg-brand-hover',
        selectedItemBg: 'bg-blue-50 dark:bg-blue-900/20',
        selectedItemBorder: 'border-blue-200 dark:border-blue-800',
        selectedItemText: 'text-blue-700 dark:text-blue-300',
        backButtonText: 'text-blue-400'
    };
    const themeConfig = {
        blue: neutralTheme,
        indigo: neutralTheme,
        orange: neutralTheme,
        green: neutralTheme
    };
    const currentTheme = themeConfig[theme] || themeConfig.blue;

    useEffect(() => {
        if (isOpen) {
            setActiveTab('fileList');
            setFileList([]);
            setSelectedFile('');
            setLogContent('');
            setSearchTerm('');
            setError('');
            setShowMobileList(true);
            setLogSearchTerm('');
            setSearchResults([]);
            setCurrentResultIndex(-1);
        }
    }, [isOpen]);

    const fetchFileList = async () => {
        setLoading(true);
        setError('');
        try {
            const { data, error: apiError } = await send(apiEndpoints.list, {}, 'GET');
            if (apiError) setError(apiError);
            else if (data?.response?.files) {
                const sortedFiles = data.response.files.sort((a, b) => new Date(b.modified_at || b.lastModified) - new Date(a.modified_at || a.lastModified));
                setFileList(sortedFiles);
            } else setError('파일 목록을 가져올 수 없습니다.');
        } catch (err) {
            setError('파일 목록 조회 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const fetchLogContent = async (filename) => {
        if (!filename) return;
        setContentLoading(true);
        try {
            const url = typeof apiEndpoints.content === 'function' ? apiEndpoints.content(filename) : `${apiEndpoints.content}/${filename}`;
            const { data, error: apiError } = await send(url, {}, 'GET');
            if (apiError) setLogContent(`[오류] 로그를 불러오는데 실패했습니다.\n${apiError}`);
            else if (data?.response) setLogContent(data.response.content || '로그 내용이 없습니다.');
            else setLogContent('로그 내용을 가져올 수 없습니다.');
        } catch (err) {
            setLogContent('[오류] 로그 조회 중 통신 오류가 발생했습니다.');
        } finally {
            setContentLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && (activeTab === 'fileList' || activeTab === 'logView')) {
            fetchFileList();
            setShowMobileList(true);
        }
    }, [activeTab, isOpen]);

    const handleFileSelect = (filename) => {
        setSelectedFile(filename);
        fetchLogContent(filename);
        setShowMobileList(false);
        setLogSearchTerm('');
        setSearchResults([]);
        setCurrentResultIndex(-1);
        resultRefs.current = {};
    };

    const handleBackToList = () => setShowMobileList(true);

    const openRealtimeLogStream = () => {
        const width = 1000, height = 700;
        const left = (window.screen.width - width) / 2, top = (window.screen.height - height) / 2;
        window.open(streamUrl, windowName, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const filteredFiles = fileList.filter(file => file.filename.toLowerCase().includes(searchTerm.toLowerCase()));

    useEffect(() => {
        resultRefs.current = {};
        if (logSearchTerm && logContent) {
            const regex = new RegExp(logSearchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            const results = [];
            let match;
            while ((match = regex.exec(logContent)) !== null) {
                if (match[0].length > 0) results.push(match.index);
            }
            setSearchResults(results);
            setCurrentResultIndex(results.length > 0 ? 0 : -1);
        } else {
            setSearchResults([]);
            setCurrentResultIndex(-1);
        }
    }, [logSearchTerm, logContent]);

    useEffect(() => {
        if (currentResultIndex !== -1 && searchResults.length > 0) {
            const resultElement = resultRefs.current[searchResults[currentResultIndex]];
            resultElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentResultIndex, searchResults]);

    const handleNextResult = () => {
        if (searchResults.length > 0) setCurrentResultIndex(prev => (prev + 1) % searchResults.length);
    };

    const handlePrevResult = () => {
        if (searchResults.length > 0) setCurrentResultIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
    };
    
    const getHighlightedLogContent = () => {
        if (!logSearchTerm || searchResults.length === 0) return logContent;
        let lastIndex = 0;
        const parts = [];
        const searchTermLength = logSearchTerm.length;
        searchResults.forEach((index, i) => {
            parts.push(logContent.substring(lastIndex, index));
            parts.push(
                <span key={index} ref={el => (resultRefs.current[index] = el)} className={`rounded transition-colors ${i === currentResultIndex ? 'bg-yellow-400 text-black' : 'bg-yellow-600/50'}`}>
                    {logContent.substring(index, index + searchTermLength)}
                </span>
            );
            lastIndex = index + searchTermLength;
        });
        parts.push(logContent.substring(lastIndex));
        return <>{parts}</>;
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                event.preventDefault();
                logSearchInputRef.current?.focus();
            }
        };
        if (isOpen && activeTab === 'logView') {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, activeTab]);

    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen);

    if (!shouldRender) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 px-0 sm:px-4 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}>
            <div className={`w-full max-w-5xl h-[85vh] sm:rounded-2xl bg-white dark:bg-slate-800 shadow-xl ring-1 ring-slate-900/5 dark:ring-slate-700 overflow-hidden flex flex-col animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`} style={{ animationDuration: '0.25s' }}>
                <div className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0`}>
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate pr-4">{title}</h2>
                    <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="shrink-0 flex gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-x-auto no-scrollbar">
                    {['fileList', 'logView', 'realtime'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? `${currentTheme.activeTabBg} text-white` : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}>
                            {tab === 'fileList' ? '파일 목록' : tab === 'logView' ? '로그 조회' : '실시간 추적'}
                            {tab === 'realtime' && <svg className="w-4 h-4 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                        </button>
                    ))}
                </div>

                {error && <div className="shrink-0 mx-4 sm:mx-6 mt-4 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"><p className="text-sm text-orange-800 dark:text-orange-200">{error}</p></div>}

                <div className="flex-1 overflow-hidden p-4 sm:p-6 relative">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-800/80 z-20">
                            <div className="flex flex-col items-center gap-3">
                                <div className={`w-10 h-10 border-4 ${currentTheme.loaderBorder} border-t-transparent rounded-full animate-spin`}></div>
                                <p className="text-sm text-slate-600 dark:text-slate-400">파일 목록을 불러오는 중...</p>
                            </div>
                        </div>
                    )}

                    {!loading && activeTab === 'fileList' && (
                        <div className="h-full overflow-y-auto">
                            {fileList.length === 0 ? (
                                <div className="text-center py-12"><svg className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><p className="text-slate-600 dark:text-slate-400">로그 파일이 없습니다.</p></div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse min-w-[500px] sm:min-w-full">
                                        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">파일명</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">크기</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">수정일</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {fileList.map(file => (
                                                <tr key={file.filename} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-mono break-all">{file.filename}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatFileSize(file.size)}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(file.modified_at || file.lastModified)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && activeTab === 'logView' && (
                        <div className="flex flex-col h-full gap-4">
                            <div className={`${!showMobileList ? 'hidden sm:block' : ''} relative shrink-0`}>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
                                <input type="text" placeholder="파일명 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${currentTheme.focusRing}`} />
                            </div>
                            <div className="flex flex-1 gap-4 overflow-hidden relative">
                                <div className={`flex flex-col border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 ${showMobileList ? 'w-full absolute inset-0 z-10 sm:relative sm:w-1/3 sm:z-0' : 'hidden sm:flex sm:w-1/3'}`}>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 font-medium text-sm text-slate-700 dark:text-slate-300">파일 목록 ({filteredFiles.length})</div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {filteredFiles.length > 0 ? filteredFiles.map(file => (
                                            <button key={file.filename} onClick={() => handleFileSelect(file.filename)} className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-all ${selectedFile === file.filename ? `${currentTheme.selectedItemBg} ${currentTheme.selectedItemText} border ${currentTheme.selectedItemBorder}` : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'}`}>
                                                <div className="font-mono truncate font-medium">{file.filename}</div>
                                                <div className="flex justify-between mt-1 text-xs opacity-70"><span>{formatDate(file.modified_at || file.lastModified)}</span><span>{formatFileSize(file.size)}</span></div>
                                            </button>
                                        )) : <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">검색 결과가 없습니다.</div>}
                                    </div>
                                </div>
                                <div className={`flex flex-col border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-900 dark:bg-black ${!showMobileList ? 'w-full absolute inset-0 z-10 sm:relative sm:flex-1 sm:z-0' : 'hidden sm:flex sm:flex-1'}`}>
                                    <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0"><button onClick={handleBackToList} className={`sm:hidden p-1 rounded-lg bg-slate-700 ${currentTheme.backButtonText}`}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button><span className="font-medium text-sm text-slate-300 truncate pr-2">{selectedFile || '파일을 선택해주세요'}</span></div>
                                        {selectedFile && <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">{logContent.length > 0 ? `${(logContent.length / 1024).toFixed(2)} KB` : '0 KB'}</span>}
                                    </div>
                                    <div className="p-2 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg></div>
                                            <input ref={logSearchInputRef} type="text" placeholder="로그 내용 검색 (Ctrl+F)..." value={logSearchTerm} onChange={e => setLogSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleNextResult() }} className={`pl-10 w-full px-3 py-1.5 rounded-md border border-slate-600 bg-slate-900 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${currentTheme.focusRing}`} />
                                        </div>
                                        <span className="text-sm text-slate-400 whitespace-nowrap w-20 text-center">{logSearchTerm ? `${searchResults.length > 0 ? currentResultIndex + 1 : 0} / ${searchResults.length}` : ''}</span>
                                        <div className="flex gap-1"><button onClick={handlePrevResult} disabled={searchResults.length === 0} className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button><button onClick={handleNextResult} disabled={searchResults.length === 0} className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button></div>
                                    </div>
                                    <div className="flex-1 overflow-auto p-4 relative">
                                        {contentLoading ? <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10"><div className={`w-8 h-8 border-4 ${currentTheme.loaderBorder} border-t-transparent rounded-full animate-spin`}></div></div> : logContent ? <pre className="text-xs sm:text-sm text-slate-200 font-mono whitespace-pre-wrap break-words leading-relaxed">{getHighlightedLogContent()}</pre> : <div className="flex items-center justify-center h-full text-slate-600 text-sm">{selectedFile ? '내용이 없습니다.' : '좌측 목록에서 로그 파일을 선택해주세요.'}</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && activeTab === 'realtime' && (
                        <div className="text-center py-12 h-full flex flex-col items-center justify-center">
                            <div className={`inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 ${currentTheme.iconBg} rounded-full mb-6 sm:mb-8`}><svg className={`w-10 h-10 sm:w-12 sm:h-12 ${currentTheme.iconText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></div>
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-3 sm:mb-4">실시간 로그 스트리밍</h3>
                            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6 sm:mb-8 max-w-md mx-auto leading-relaxed px-4">로그 파일 조회는 정적 데이터를 보여주지만,<br className="hidden sm:block"/> 실시간 스트리밍은 현재 발생하고 있는 로그를<br className="hidden sm:block"/> <strong>별도 윈도우</strong>에서 실시간으로 추적할 수 있습니다.</p>
                            <button onClick={openRealtimeLogStream} className={`px-6 py-3 ${currentTheme.streamBtn} text-white text-base font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap`}><svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>실시간 로그 추적 시작</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
