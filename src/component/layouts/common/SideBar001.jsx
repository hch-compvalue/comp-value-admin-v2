import { Link, useLocation } from 'react-router-dom';
import routes from '@/config/routes';
import { useState, useEffect, useMemo } from 'react';
import { hasAnyRole } from '@/util/RoleUtil';
import { useAuth } from '@/context/AuthContext';
import { useTab } from '@/context/TabContext';
import GlobalSearchBar from './GlobalSearchBar';
import CommandPalette from './CommandPalette';
import {
    Home as HomeIcon, Globe, MessageSquare, Bot, Wrench,
    Activity, ChevronDown
} from 'lucide-react';

function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= breakpoint);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);
    return isMobile;
}

export const SECTIONS = ['시작하기', '미국주식', '게시판', '자동매매', '유틸', '관리'];

// 섹션별 헤더 아이콘 (아코디언 헤더에 표시)
const SECTION_ICONS = {
    '시작하기': HomeIcon,
    '미국주식': Globe,
    '게시판': MessageSquare,
    '자동매매': Bot,
    '유틸': Wrench,
    '관리': Activity,
};

// 아코디언 펼침 상태를 localStorage에 저장하는 키
const OPEN_SECTIONS_KEY = 'sidebar.openSections';

function loadOpenSections() {
    try {
        const raw = localStorage.getItem(OPEN_SECTIONS_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        // 파싱 실패 시 기본값 사용
    }
    return null;
}

export default function SideBar001({ isSidebarOpen, setSidebarOpen, setIsPinned, isDesktopCollapsed, onMouseEnter, onMouseLeave }) {
    const isMobile = useIsMobile();
    const location = useLocation();
    const { roles: userRoles } = useAuth();
    const { openTab } = useTab();
    const [isPaletteOpen, setPaletteOpen] = useState(false);

    // 현재 경로가 속한 섹션 (아코디언 자동 펼침용)
    const activeSection = useMemo(() => {
        const entry = Object.values(routes).find(r => r.path === location.pathname);
        return entry?.section;
    }, [location.pathname]);

    // 아코디언 펼침 상태: 저장값 우선, 없으면 현재 섹션만 펼침
    const [openSections, setOpenSections] = useState(() => {
        const saved = loadOpenSections();
        if (saved) return saved;
        return activeSection ? { [activeSection]: true } : {};
    });

    // 다른 메뉴로 이동하면 해당 섹션을 자동으로 펼침
    useEffect(() => {
        if (activeSection) {
            setOpenSections(prev => prev[activeSection] ? prev : { ...prev, [activeSection]: true });
        }
    }, [activeSection]);

    // 펼침 상태 변경 시 localStorage에 저장
    useEffect(() => {
        try {
            localStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify(openSections));
        } catch {
            // 저장 실패는 무시 (시크릿 모드 등)
        }
    }, [openSections]);

    // 마우스를 올린 섹션 (hover 시 임시로 하위 메뉴 펼침)
    const [hoveredSection, setHoveredSection] = useState(null);

    const toggleSection = (sectionLabel) => {
        const willClose = !!openSections[sectionLabel]; // 현재 고정 열림 상태면 이번 클릭은 '닫기'
        setOpenSections(prev => ({ ...prev, [sectionLabel]: !prev[sectionLabel] }));
        // 닫는 경우, 마우스가 올려져 있어도 즉시 닫히도록 hover 상태 해제
        if (willClose) {
            setHoveredSection(curr => (curr === sectionLabel ? null : curr));
        }
    };

    const handleLinkClick = (path) => {
        openTab(path);
        if (isMobile && setSidebarOpen) {
            setSidebarOpen(false);
            setIsPinned && setIsPinned(false);
        }
    };

    const handlePaletteOpen = () => setPaletteOpen(true);
    const handlePaletteClose = () => {
        setPaletteOpen(false);
        if (isMobile && setSidebarOpen) {
            setSidebarOpen(false);
            setIsPinned && setIsPinned(false);
        }
    };

    const renderSection = (sectionLabel) => {
        const items = Object.entries(routes).filter(
            ([, route]) => {
                // show가 false이면 숨김
                if (route.show === false) return false;
                // 섹션이 일치하지 않으면 숨김
                if (route.section !== sectionLabel) return false;
                // 접근 권한(accessRoles, 페이지 접근 차단과 같은 기준)이 없으면 메뉴도 숨김
                const roles = route.accessRoles || route.requiredRoles;
                if (roles && roles.length > 0) {
                    return hasAnyRole(userRoles, roles);
                }
                return true;
            }
        );
        if (!items.length) return null;

        // 클릭으로 고정됐거나(openSections), 마우스를 올린(hoveredSection) 섹션은 펼침
        const isOpen = !!openSections[sectionLabel] || hoveredSection === sectionLabel;
        const SectionIcon = SECTION_ICONS[sectionLabel];

        return (
            <div
                key={sectionLabel}
                className="mt-4"
                onMouseEnter={() => setHoveredSection(sectionLabel)}
                onMouseLeave={() => setHoveredSection(prev => (prev === sectionLabel ? null : prev))}
            >
                {/* 아코디언 헤더 — 클릭 시 섹션 접기/펼치기 */}
                <button
                    type="button"
                    onClick={() => toggleSection(sectionLabel)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2.5 text-sm font-semibold text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
                >
                    <span className="flex items-center gap-2">
                        {SectionIcon && <SectionIcon className="h-4 w-4 shrink-0" />}
                        <span>{sectionLabel}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ease-out ${isOpen ? '' : '-rotate-90'}`} />
                </button>

                {/* 펼침 영역 — grid-rows 트릭으로 부드럽게 열고 닫음 */}
                <div className={`grid transition-all duration-200 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                        {/* 하위 메뉴: 세로 가이드 라인 + 들여쓰기로 상위 섹션과 구분 (검색창과 동일 패턴) */}
                        <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-2 dark:border-slate-700">
                            {items.map(([key, route]) => {
                                const isActive = location.pathname === route.path;
                                const ItemIcon = route.icon;
                                return (
                                    <Link
                                        key={key}
                                        to={route.path}
                                        onClick={() => handleLinkClick(route.path)}
                                        className={`group relative flex items-center rounded-md px-3 py-2 text-sm transition-all duration-200 ease-out ${
                                            isActive
                                                ? 'bg-blue-50 text-blue-600 font-semibold dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white'
                                        }`}
                                    >
                                        {/* 왼쪽 인디케이터 바 */}
                                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-brand transition-all duration-200 ease-out dark:bg-blue-400 ${
                                            isActive
                                                ? 'h-5 opacity-100'
                                                : 'h-0 opacity-0 group-hover:h-3.5 group-hover:opacity-70'
                                        }`} />
                                        {ItemIcon && <ItemIcon className="mr-2 h-4 w-4 shrink-0" />}
                                        <span className="line-clamp-2 break-words leading-snug">{route.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <aside
            className={`${
                isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
            } fixed inset-y-16 left-0 z-30 w-60 transform border-r border-slate-200 bg-white px-3 py-4 text-sm shadow-lg transition-all duration-200 ease-out md:static md:inset-y-0 md:bg-white md:shadow-none dark:bg-slate-900 dark:border-slate-700 md:dark:bg-slate-900 ${
                isDesktopCollapsed
                    ? 'md:w-0 md:min-w-0 md:overflow-hidden md:opacity-0 md:p-0 md:border-0'
                    : 'md:translate-x-0 md:opacity-100 md:w-64 md:shrink-0'
            }`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <nav className="scrollbar-always flex h-full flex-col overflow-y-auto pb-6">
                <div className="sticky top-0 z-10 -mx-3 mb-2 bg-white px-3 pb-2 pt-1 dark:bg-slate-900/95">
                    <GlobalSearchBar onOpen={handlePaletteOpen} />
                </div>
                {SECTIONS.map(renderSection)}
            </nav>
            <CommandPalette open={isPaletteOpen} onClose={handlePaletteClose} />
        </aside>
    );
}