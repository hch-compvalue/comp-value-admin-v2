import { useState, useRef, useEffect } from 'react';
import useModalAnimation from '@/hooks/useModalAnimation';

import Header from '@/component/layouts/common/Header001';
import SideBar from '@/component/layouts/common/SideBar001';
import TabBar from '@/component/layouts/common/TabBar';
import TabSheet from '@/component/layouts/common/TabSheet';
import KeepAliveOutlet from '@/component/layouts/common/KeepAliveOutlet';
import { useTab } from '@/context/TabContext';

function Layout001() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
    const sidebarTimeoutRef = useRef(null);
    const mainRef = useRef(null);
    const { shouldRender: showOverlay, isAnimatingOut: isOverlayFading } = useModalAnimation(isSidebarOpen, 200);
    const { activeKey } = useTab();

    // 탭 전환 시 스크롤 최상단으로 이동
    useEffect(() => {
        requestAnimationFrame(() => {
            mainRef.current?.scrollTo(0, 0);
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
        });
    }, [activeKey]);

    const handleMenuClick = () => {
        if (window.innerWidth >= 768) {
            // 데스크톱: 사이드바 접기/펼치기
            setIsDesktopCollapsed(prev => !prev);
        } else {
            // 모바일: 오버레이 사이드바 토글
            if (sidebarTimeoutRef.current) {
                clearTimeout(sidebarTimeoutRef.current);
            }
            if (isPinned) {
                setIsPinned(false);
                setIsSidebarOpen(false);
            } else {
                setIsPinned(true);
                setIsSidebarOpen(true);
            }
        }
    };

    const handleMenuHover = () => {
        if (isPinned) return;
        if (sidebarTimeoutRef.current) {
            clearTimeout(sidebarTimeoutRef.current);
        }
        setIsSidebarOpen(true);
    };

    const handleMenuLeave = () => {
        if (isPinned) return;
        sidebarTimeoutRef.current = setTimeout(() => {
            setIsSidebarOpen(false);
        }, 300);
    };

    const handleSidebarMouseEnter = () => {
        if (isPinned) return;
        if (sidebarTimeoutRef.current) {
            clearTimeout(sidebarTimeoutRef.current);
        }
    };

    const handleSidebarMouseLeave = () => {
        if (isPinned) return;
        sidebarTimeoutRef.current = setTimeout(() => {
            setIsSidebarOpen(false);
        }, 300);
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
            <Header
                onMenuClick={handleMenuClick}
                onMenuHover={handleMenuHover}
                onMenuLeave={handleMenuLeave}
            />
            <TabBar />

            {/* 모바일에서 사이드바가 열렸을 때 배경 클릭 시 닫히는 오버레이 */}
            {showOverlay && (
                <div
                    className={`fixed inset-16 inset-x-0 z-20 bg-black/20 md:hidden animate__animated ${isOverlayFading ? 'animate__fadeOut' : 'animate__fadeIn'}`}
                    style={{ animationDuration: '0.2s' }}
                    onClick={() => {
                        setIsSidebarOpen(false);
                        setIsPinned(false);
                    }}
                />
            )}

            <div className="flex w-full flex-1">
                <SideBar
                    isSidebarOpen={isSidebarOpen}
                    setSidebarOpen={setIsSidebarOpen}
                    setIsPinned={setIsPinned}
                    isDesktopCollapsed={isDesktopCollapsed}
                    onMouseEnter={handleSidebarMouseEnter}
                    onMouseLeave={handleSidebarMouseLeave}
                />

                <main ref={mainRef} className="scrollbar-always relative flex-1 overflow-auto bg-canvas p-4 md:p-6">
                    <TabSheet />
                    <KeepAliveOutlet />
                </main>
            </div>
        </div>
    );
}

export default Layout001;