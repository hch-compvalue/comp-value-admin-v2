import { useAuth } from '@/context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { send } from '@/util/ClientUtil';
import routes from '@/config/routes';
import { hasAnyRole } from '@/util/RoleUtil';
import { TabActiveContext } from '@/context/TabContext';

// 로그인 없이 접근 가능한 공개 페이지 목록
const PUBLIC_ROUTES = [
    '/',
    '/member/join'
];

// 경로가 공개 페이지인지 확인하는 헬퍼 함수
const isPublicRoute = (pathname) => {
    return PUBLIC_ROUTES.some(route => {
        // 정확히 일치하는 경로
        if (route === pathname) return true;
        // 와일드카드 패턴 지원 (필요시 확장 가능)
        // 예: '/public/*' 같은 패턴
        return false;
    });
};

// 현재 경로에 해당하는 라우트 설정 찾기
const findRouteByPath = (pathname) => {
    for (const [, route] of Object.entries(routes)) {
        if (route.path === pathname) return route;
    }
    return null;
};

function PrivateRoute({ children }) {
    // 비활성 탭(display:none)에서는 불필요한 API 호출과 auth 체크를 스킵
    const isTabActive = useContext(TabActiveContext) ?? true;
    const { isLoggedIn, setIsLoggedIn, roles: userRoles } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [checking, setChecking] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);

    // Guard for stale async results when effect re-runs
    const runIdRef = useRef(0);

    const checkAuth = useCallback(async () => {
        const myId = ++runIdRef.current;
        setChecking(true);
        try {
            const { data } = await send('/dart/member/me', {}, 'GET');
            if (runIdRef.current !== myId) return;

            const ok = !!(data && data.success);
            setIsLoggedIn(ok);
            setHasChecked(true);
        } catch (e) {
            if (runIdRef.current !== myId) return;
            setIsLoggedIn(false);
            setHasChecked(true);
        } finally {
            if (runIdRef.current === myId) setChecking(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 페이지 이동 시 인증 체크 (활성 탭에서만)
    useEffect(() => {
        if (!isTabActive) return;
        checkAuth();
    }, [location.pathname, isTabActive, checkAuth]);

    // 브라우저 탭 복귀 시 세션 재검증 (활성 탭에서만)
    useEffect(() => {
        if (!isTabActive) return;
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                checkAuth();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [isTabActive, checkAuth]);

    // 비활성 탭: 항상 children 렌더링 (컴포넌트 상태 보존)
    if (!isTabActive) return children;

    const isPublic = isPublicRoute(location.pathname);

    // 최초 검사 전: 보호 라우트는 스피너 표시, 공개 페이지는 항상 렌더
    // 재검증(탭 복귀, 페이지 이동 등)에서는 기존 화면을 유지한 채 백그라운드 체크
    if (!hasChecked) {
        if (isPublic) return children;
        return (
            <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
            </div>
        );
    }

    // 미로그인: 보호 라우트만 막고, 공개 페이지는 렌더
    if (isLoggedIn === false) {
        if (isPublic) return children;

        // 보호된 페이지에서 미로그인일 때: 안내 다이어그램 + 로그인 유도
        return (
            <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-4">
                <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.8}
                            stroke="currentColor"
                            className="h-7 w-7"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h9.75A2.25 2.25 0 0019.5 18.75V12M12 9h7.5M15.75 5.25L19.5 9"
                            />
                        </svg>
                    </div>
                    <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">로그인이 필요합니다</h2>
                    <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        선택하신 메뉴는 로그인 후 이용할 수 있는 기능입니다.
                        <br />
                        로그인하면 보유 종목, 기업가치 분석 등 더 많은 서비스를 사용할 수 있어요.
                    </p>
                    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('auth:login:open'));
                            }}
                            className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
                        >
                            로그인하기
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-200"
                        >
                            홈으로 가기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // accessRoles 체크: 로그인은 되어있지만 접근 권한이 없는 경우
    const currentRoute = findRouteByPath(location.pathname);
    if (currentRoute?.accessRoles && currentRoute.accessRoles.length > 0) {
        if (!hasAnyRole(userRoles, currentRoute.accessRoles)) {
            return (
                <div className="flex min-h-[calc(100vh-120px)] items-center justify-center px-4">
                    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.8}
                                stroke="currentColor"
                                className="h-7 w-7"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                />
                            </svg>
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">접근 권한이 없습니다</h2>
                        <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                            이 페이지는 관리자 권한이 필요합니다.
                            <br />
                            권한이 필요하시면 관리자에게 문의해주세요.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-6 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-200"
                        >
                            뒤로 가기
                        </button>
                    </div>
                </div>
            );
        }
    }

    return children;
}

export default PrivateRoute;