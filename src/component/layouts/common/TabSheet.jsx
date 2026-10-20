import { useState } from 'react';
import { useTab } from '@/context/TabContext';
import useModalAnimation from '@/hooks/useModalAnimation';

export default function TabSheet() {
    const { tabs, activeKey, switchTab, closeTab, closeAllTabs } = useTab();
    const [isOpen, setIsOpen] = useState(false);
    const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen, 200);

    const activeTab = tabs.find(t => t.key === activeKey);
    const activeLabel = activeTab?.label || activeKey;

    const handleTabClick = (key) => {
        switchTab(key);
        setIsOpen(false);
    };

    return (
        <div className="md:hidden">
            {/* 트리거 버튼 */}
            <button
                onClick={() => setIsOpen(true)}
                className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="max-w-[140px] truncate font-medium">{activeLabel}</span>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                    {tabs.length}
                </span>
            </button>

            {/* 바텀 시트 오버레이 + 시트 */}
            {shouldRender && (
                <div className="fixed inset-0 z-50">
                    {/* 배경 오버레이 */}
                    <div
                        className={`absolute inset-0 bg-black/30 animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
                        style={{ animationDuration: '0.2s' }}
                        onClick={() => setIsOpen(false)}
                    />

                    {/* 바텀 시트 */}
                    <div
                        className={`absolute bottom-0 left-0 right-0 max-h-[60vh] rounded-t-2xl border-t border-slate-200 bg-white pb-safe animate__animated ${
                            isAnimatingOut ? 'animate__slideOutDown' : 'animate__slideInUp'
                        } dark:border-slate-700 dark:bg-slate-900`}
                        style={{ animationDuration: '0.2s' }}
                    >
                        {/* 핸들 바 */}
                        <div className="flex justify-center py-2">
                            <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
                        </div>

                        {/* 헤더 */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 pb-2 dark:border-slate-800">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                열린 탭 ({tabs.length})
                            </span>
                            <div className="flex items-center gap-1">
                                {tabs.some(t => t.closable) && (
                                    <button
                                        onClick={() => { closeAllTabs(); setIsOpen(false); }}
                                        className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    >
                                        전체 닫기
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* 탭 목록 */}
                        <div className="overflow-y-auto px-2 py-2" style={{ maxHeight: 'calc(60vh - 80px)' }}>
                            {tabs.map((tab) => {
                                const isActive = tab.key === activeKey;
                                return (
                                    <div
                                        key={tab.key}
                                        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 ${
                                            isActive
                                                ? 'bg-blue-50 dark:bg-blue-900/20'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <button
                                            onClick={() => handleTabClick(tab.key)}
                                            className="flex min-w-0 flex-1 items-center gap-2"
                                        >
                                            {isActive && (
                                                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                                            )}
                                            <span className={`truncate text-sm ${
                                                isActive
                                                    ? 'font-semibold text-blue-600 dark:text-blue-400'
                                                    : 'text-slate-600 dark:text-slate-300'
                                            }`}>
                                                {tab.label}
                                            </span>
                                        </button>
                                        {tab.closable && (
                                            <button
                                                onClick={() => closeTab(tab.key)}
                                                className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
