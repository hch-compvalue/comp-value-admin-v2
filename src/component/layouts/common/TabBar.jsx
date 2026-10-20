import { useState, useRef, useEffect, useCallback } from 'react';
import { useTab } from '@/context/TabContext';

export default function TabBar() {
    const { tabs, activeKey, switchTab, closeTab, closeAllTabs, closeOtherTabs, closeRightTabs } = useTab();
    const [contextMenu, setContextMenu] = useState(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const scrollRef = useRef(null);
    const menuRef = useRef(null);

    // 스크롤 가능 여부 체크
    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }, []);

    // 탭 변경, 리사이즈 시 스크롤 상태 업데이트
    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [tabs, checkScroll]);

    // 스크롤 이벤트 감지
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScroll, { passive: true });
        return () => el.removeEventListener('scroll', checkScroll);
    }, [checkScroll]);

    // 마우스 휠로 좌우 스크롤
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handleWheel = (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    // 컨텍스트 메뉴 외부 클릭 시 닫기
    useEffect(() => {
        if (!contextMenu) return;
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [contextMenu]);

    // 활성 탭이 바뀌면 스크롤로 보이게
    useEffect(() => {
        if (!scrollRef.current) return;
        const activeEl = scrollRef.current.querySelector('[data-active="true"]');
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, [activeKey]);

    const scrollBy = useCallback((direction) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ left: direction * 200, behavior: 'smooth' });
    }, []);

    const handleContextMenu = useCallback((e, tab) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, tabKey: tab.key, closable: tab.closable });
    }, []);

    const handleMenuAction = useCallback((action) => {
        const key = contextMenu?.tabKey;
        setContextMenu(null);
        if (!key) return;
        if (action === 'close') closeTab(key);
        else if (action === 'closeAll') closeAllTabs();
        else if (action === 'closeOthers') closeOtherTabs(key);
        else if (action === 'closeRight') closeRightTabs(key);
    }, [contextMenu, closeTab, closeAllTabs, closeOtherTabs, closeRightTabs]);

    const ArrowButton = ({ direction, visible, onClick }) => (
        <button
            onClick={onClick}
            className={`flex h-10 w-7 shrink-0 items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-all duration-150 ${
                visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label={direction === -1 ? '왼쪽 스크롤' : '오른쪽 스크롤'}
        >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {direction === -1
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                }
            </svg>
        </button>
    );

    return (
        <div className="hidden md:block sticky top-16 z-[35] border-b border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
            <div className="flex items-end">
                <ArrowButton direction={-1} visible={canScrollLeft} onClick={() => scrollBy(-1)} />

                <div
                    ref={scrollRef}
                    className="flex h-10 flex-1 items-end overflow-x-auto"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <style>{`.tabbar-scroll::-webkit-scrollbar { display: none; }`}</style>
                    {tabs.map((tab) => {
                        const isActive = tab.key === activeKey;
                        return (
                            <button
                                key={tab.key}
                                data-active={isActive}
                                onClick={() => switchTab(tab.key)}
                                onContextMenu={(e) => handleContextMenu(e, tab)}
                                className={`group relative flex shrink-0 items-center gap-1.5 pl-4 pr-2.5 pb-2 pt-1.5 text-sm rounded-t-md transition-all duration-200 ease-out select-none ${
                                    isActive
                                        ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
                                }`}
                            >
                                <span className="max-w-[140px] truncate">{tab.label}</span>
                                {tab.closable && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); closeTab(tab.key); }}
                                        className="ml-1 flex h-5 w-5 items-center justify-center rounded-sm transition-all duration-150 opacity-0 group-hover:opacity-100 hover:bg-slate-200/80 active:scale-90 dark:hover:bg-slate-700"
                                    >
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </span>
                                )}
                                {/* 하단 인디케이터 - 호버 시 미리보기, 활성 시 전체 표시 */}
                                <span className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand transition-all duration-200 ease-out origin-center dark:bg-blue-400 ${
                                    isActive
                                        ? 'scale-x-100 opacity-100'
                                        : 'scale-x-0 opacity-0 group-hover:scale-x-75 group-hover:opacity-40'
                                }`} />
                            </button>
                        );
                    })}
                </div>

                <ArrowButton direction={1} visible={canScrollRight} onClick={() => scrollBy(1)} />

                {/* 전체 닫기 버튼 - closable 탭이 1개 이상일 때만 표시 */}
                {tabs.some(t => t.closable) && (
                    <button
                        onClick={closeAllTabs}
                        className="flex h-10 w-8 shrink-0 items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-all duration-150 border-l border-slate-200 dark:border-slate-700"
                        title="탭 전체 닫기"
                        aria-label="탭 전체 닫기"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* 우클릭 컨텍스트 메뉴 */}
            {contextMenu && (
                <div
                    ref={menuRef}
                    className="fixed z-50 min-w-[160px] rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    {contextMenu.closable && (
                        <button
                            onClick={() => handleMenuAction('close')}
                            className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            닫기
                        </button>
                    )}
                    <button
                        onClick={() => handleMenuAction('closeAll')}
                        className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        전체 닫기
                    </button>
                    <button
                        onClick={() => handleMenuAction('closeOthers')}
                        className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        다른 탭 모두 닫기
                    </button>
                    <button
                        onClick={() => handleMenuAction('closeRight')}
                        className="flex w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        오른쪽 탭 모두 닫기
                    </button>
                </div>
            )}
        </div>
    );
}
