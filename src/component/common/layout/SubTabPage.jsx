import { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TabActiveContext } from '@/context/TabContext';
import { useAuth } from '@/context/AuthContext';
import { hasAnyRole } from '@/util/RoleUtil';
import { EmbeddedPageContext } from '@/context/EmbeddedPageContext';

const STORAGE_PREFIX = 'subTab:';

const loadSavedTab = (basePath) => {
    try {
        return sessionStorage.getItem(STORAGE_PREFIX + basePath);
    } catch {
        return null;
    }
};

const saveTab = (basePath, key) => {
    try {
        sessionStorage.setItem(STORAGE_PREFIX + basePath, key);
    } catch { /* 저장 실패 무시 */ }
};

/**
 * 하위 탭 페이지: 기존 페이지 여러 개를 한 메뉴 아래 탭으로 묶는다
 * - 한 번 연 탭은 숨김 처리로 유지해 조회 결과·진행 중인 작업을 보존한다 (처음 열 때만 마운트)
 * - navigate(basePath, { state: { subTab } })로 외부에서 특정 탭을 지정해 열 수 있다
 *
 * @param {string} basePath - 이 페이지의 라우트 경로
 * @param {string} section - 브레드크럼 섹션명
 * @param {string} label - 메뉴명 (브레드크럼 상위)
 * @param {{key: string, label: string, element: JSX.Element, accessRoles?: string[]}[]} tabs
 *        - 하위 탭 목록 (accessRoles가 있으면 해당 권한 보유자에게만 탭 노출)
 */
export default function SubTabPage({ basePath, section, label, tabs: allTabs }) {
    const location = useLocation();
    const { roles: userRoles } = useAuth();
    const tabs = useMemo(() => allTabs.filter((t) => !t.accessRoles?.length || hasAnyRole(userRoles, t.accessRoles)), [allTabs, userRoles]);
    const isPageActive = useContext(TabActiveContext) ?? true;
    const isValidKey = (key) => tabs.some((t) => t.key === key);

    const [activeKey, setActiveKey] = useState(() => {
        const requested = location.state?.subTab;
        if (isValidKey(requested)) return requested;
        const saved = loadSavedTab(basePath);
        return isValidKey(saved) ? saved : tabs[0].key;
    });
    const [mountedKeys, setMountedKeys] = useState(() => new Set([activeKey]));

    const selectTab = (key) => {
        setActiveKey(key);
        setMountedKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
        saveTab(basePath, key);
    };

    // 권한 변경 등으로 현재 탭이 목록에서 빠지면 첫 탭으로
    useEffect(() => {
        if (tabs.length > 0 && !isValidKey(activeKey)) selectTab(tabs[0].key);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs, activeKey]);

    // 외부에서 state.subTab을 지정해 이동해 온 경우 해당 탭으로 전환
    // (KeepAlive로 다른 탭의 이동에도 이 컴포넌트가 반응하므로 자기 경로일 때만 처리)
    useEffect(() => {
        if (location.pathname !== basePath) return;
        const requested = location.state?.subTab;
        if (isValidKey(requested)) selectTab(requested);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);

    return (
        <>
            <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-slate-200 dark:border-slate-700">
                {tabs.map((tab) => {
                    const isActive = tab.key === activeKey;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => selectTab(tab.key)}
                            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                isActive
                                    ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-500'
                            }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {tabs.map((tab) => {
                if (!mountedKeys.has(tab.key)) return null;
                const isActive = tab.key === activeKey;
                return (
                    <div key={tab.key} role="tabpanel" style={{ display: isActive ? 'block' : 'none' }}>
                        <TabActiveContext.Provider value={isPageActive && isActive}>
                            <EmbeddedPageContext.Provider value={{ section, parentLabel: label, label: tab.label }}>
                                {tab.element}
                            </EmbeddedPageContext.Provider>
                        </TabActiveContext.Provider>
                    </div>
                );
            })}
        </>
    );
}
