import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, matchPath } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import routes from '@/config/routes';

const TabContext = createContext();

/** PrivateRoute 등에서 현재 탭이 활성 상태인지 판단하는 Context (기본값 true) */
export const TabActiveContext = createContext(true);

const STORAGE_KEY = 'openTabs';
const HOME_TAB = { key: '/', path: '/', label: 'Home', closable: false };

function findRouteLabel(pathname) {
    for (const [, route] of Object.entries(routes)) {
        if (route.path === pathname) return route.label;
        if (route.children) {
            for (const child of route.children) {
                const basePath = route.path.replace(/\/$/, '');
                const fullPath = basePath + '/' + child.path;
                if (matchPath(fullPath, pathname)) return child.label || route.label;
            }
        }
    }
    return pathname;
}

function findRoutePattern(pathname) {
    for (const [, route] of Object.entries(routes)) {
        if (!route.children) continue;
        for (const child of route.children) {
            if (!child.path.includes(':')) continue;
            const basePath = route.path.replace(/\/$/, '');
            const fullPattern = basePath + '/' + child.path;
            if (matchPath(fullPattern, pathname)) return fullPattern;
        }
    }
    return null;
}

function resolveTabUpdate(prev, pathname) {
    if (prev.some(t => t.key === pathname)) return prev;

    const label = findRouteLabel(pathname);
    const pattern = findRoutePattern(pathname);

    if (pattern) {
        const existingIdx = prev.findIndex(t => matchPath(pattern, t.key));
        if (existingIdx !== -1) {
            const next = [...prev];
            next[existingIdx] = { key: pathname, path: pathname, label, closable: true };
            return next;
        }
    }

    return [...prev, { key: pathname, path: pathname, label, closable: pathname !== '/' }];
}

function loadTabs() {
    const pathname = window.location.pathname;
    if (pathname === '/') return [HOME_TAB];
    const label = findRouteLabel(pathname);
    return [HOME_TAB, { key: pathname, path: pathname, label, closable: true }];
}

function saveTabs(tabs) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    } catch { /* ignore */ }
}

export function TabProvider({ children }) {
    const [tabs, setTabs] = useState(loadTabs);
    const [activeKey, setActiveKey] = useState(() => {
        const path = window.location.pathname;
        return path || '/';
    });
    const navigate = useNavigate();
    const location = useLocation();
    const { isLoggedIn } = useAuth();
    const isNavigatingRef = useRef(false);
    const prevLoggedInRef = useRef(isLoggedIn);

    // tabs가 변경될 때마다 sessionStorage 저장
    useEffect(() => {
        saveTabs(tabs);
    }, [tabs]);

    // 로그아웃 감지: isLoggedIn이 true → false로 전환되면 탭 초기화
    useEffect(() => {
        if (prevLoggedInRef.current === true && isLoggedIn === false) {
            setTabs([HOME_TAB]);
            setActiveKey('/');
        }
        prevLoggedInRef.current = isLoggedIn;
    }, [isLoggedIn]);

    // URL 변경 감지 → 활성 탭 동기화 + 필요시 탭 자동 추가
    useEffect(() => {
        if (isNavigatingRef.current) {
            isNavigatingRef.current = false;
            return;
        }

        const pathname = location.pathname;
        setActiveKey(pathname);

        setTabs(prev => resolveTabUpdate(prev, pathname));
    }, [location.pathname]);

    const openTab = useCallback((path) => {
        setTabs(prev => resolveTabUpdate(prev, path));
        setActiveKey(path);
    }, []);

    const switchTab = useCallback((key) => {
        setActiveKey(key);
        isNavigatingRef.current = true;
        navigate(key);
    }, [navigate]);

    const closeTab = useCallback((key) => {
        if (key === '/') return;

        setTabs(prev => {
            const idx = prev.findIndex(t => t.key === key);
            if (idx === -1) return prev;

            const next = prev.filter(t => t.key !== key);

            setActiveKey(currentKey => {
                if (currentKey === key) {
                    const newActive = prev[idx + 1]?.key ?? prev[idx - 1]?.key ?? '/';
                    isNavigatingRef.current = true;
                    navigate(newActive);
                    return newActive;
                }
                return currentKey;
            });

            return next;
        });
    }, [navigate]);

    const closeOtherTabs = useCallback((key) => {
        setTabs(prev => prev.filter(t => t.key === '/' || t.key === key));
        setActiveKey(current => {
            if (current !== '/' && current !== key) {
                isNavigatingRef.current = true;
                navigate(key);
                return key;
            }
            return current;
        });
    }, [navigate]);

    /** 특정 탭을 닫고 지정한 경로로 이동 (등록/수정/삭제 완료 후 사용, navigateOptions는 navigate에 그대로 전달) */
    const closeTabAndNavigate = useCallback((tabKeyToClose, targetPath, navigateOptions) => {
        if (tabKeyToClose === '/') return;

        setTabs(prev => {
            const filtered = prev.filter(t => t.key !== tabKeyToClose);
            return resolveTabUpdate(filtered, targetPath);
        });

        setActiveKey(targetPath);
        isNavigatingRef.current = true;
        navigate(targetPath, navigateOptions);
    }, [navigate]);

    const closeAllTabs = useCallback(() => {
        setTabs([HOME_TAB]);
        setActiveKey('/');
        isNavigatingRef.current = true;
        navigate('/');
    }, [navigate]);

    const closeRightTabs = useCallback((key) => {
        setTabs(prev => {
            const idx = prev.findIndex(t => t.key === key);
            if (idx === -1) return prev;
            const kept = prev.slice(0, idx + 1);

            setActiveKey(current => {
                const stillExists = kept.some(t => t.key === current);
                if (!stillExists) {
                    isNavigatingRef.current = true;
                    navigate(key);
                    return key;
                }
                return current;
            });

            return kept;
        });
    }, [navigate]);

    return (
        <TabContext.Provider value={{ tabs, activeKey, openTab, switchTab, closeTab, closeTabAndNavigate, closeAllTabs, closeOtherTabs, closeRightTabs }}>
            {children}
        </TabContext.Provider>
    );
}

export function useTab() {
    const context = useContext(TabContext);
    if (!context) {
        throw new Error('useTab must be used within TabProvider');
    }
    return context;
}
