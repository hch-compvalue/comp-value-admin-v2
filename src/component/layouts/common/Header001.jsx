import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import routes from '@/config/routes';
import { send } from '@/util/ClientUtil';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';

import LoginModal from '@/component/layouts/common/popup/LoginModal';
import AlertModal from '@/component/layouts/common/popup/AlertModal';

// 세션 동기화 주기 (5분)
const SESSION_SYNC_INTERVAL = 5 * 60 * 1000;

// 공개 페이지 목록 (PrivateRoutes.jsx와 동일)
const PUBLIC_ROUTES = [
    '/',
    '/member/join'
];

export default function Header001({ onMenuClick, onMenuHover, onMenuLeave }) {
    const [title] = useState('CompValue');
    const [showLogin, setShowLogin] = useState(false);
    const [displayName, setDisplayName] = useState('');

    const { isLoggedIn, setIsLoggedIn, userName, setUserName, nickName, setNickName, roles, setRoles } = useAuth();
    const { sessionTTL, startSessionTimer, resetSessionTimer, stopSessionTimer, syncSessionTTL } = useSession();
    const { isDark, toggleTheme } = useTheme();
    const location = useLocation();

    const [loginUsername, setLoginUsername] = useState('');
    const [password, setPassWord] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });
    const syncIntervalRef = useRef(null);

    const navigate = useNavigate();

    // 세션 TTL 포맷팅 (MM:SS)
    const formatTTL = useCallback((seconds) => {
        if (seconds == null || seconds < 0) return null;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, []);

    // 주기적 세션 동기화 (5분마다)
    const syncSession = useCallback(async () => {
        if (!isLoggedIn) return;

        try {
            const { data, error } = await send('/dart/member/me/info', {}, 'GET');
            if (!error && data?.success && data.response?.sessionTTL != null) {
                syncSessionTTL(data.response.sessionTTL);
            }
        } catch (e) {
            // 동기화 실패 시 무시 (다음 주기에 재시도)
        }
    }, [isLoggedIn, syncSessionTTL]);

    // 세션 활동 이벤트 리스너 (API 호출 성공 시 타이머 동기화)
    useEffect(() => {
        const onSessionActivity = (event) => {
            if (isLoggedIn) {
                // 이벤트에서 전달받은 sessionTTL 값이 있으면 동기화
                // 없으면 타이머를 변경하지 않음 (주기적 동기화가 처리)
                const ttl = event?.detail?.sessionTTL;
                if (ttl != null && ttl > 0) {
                    syncSessionTTL(ttl);
                }
                // sessionTTL이 없는 경우 타이머를 리셋하지 않음
            }
        };

        window.addEventListener('session:activity', onSessionActivity);
        return () => window.removeEventListener('session:activity', onSessionActivity);
    }, [isLoggedIn, syncSessionTTL]);

    // 주기적 세션 동기화 설정
    useEffect(() => {
        if (isLoggedIn) {
            // 로그인 시 즉시 동기화
            syncSession();

            // 5분마다 동기화
            syncIntervalRef.current = setInterval(syncSession, SESSION_SYNC_INTERVAL);
        } else {
            // 로그아웃 시 동기화 중지
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
                syncIntervalRef.current = null;
            }
        }

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [isLoggedIn, syncSession]);

    const openAlert = (message, onConfirm) => {
        setAlertConfig({ open: true, message, onConfirm: onConfirm || null });
    };

    const handleCloseAlert = () => {
        const { onConfirm } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null });
        if (onConfirm) onConfirm();
    };

    // displayName 초기화 및 업데이트
    useEffect(() => {
        const updateDisplayName = () => {
            const name = localStorage.getItem('nickName') || localStorage.getItem('userName');
            setDisplayName(name || '');
        };

        // 초기 로드 시 설정
        updateDisplayName();

        // storage 이벤트 리스너 추가 (localStorage 변경 감지)
        window.addEventListener('storage', updateDisplayName);

        return () => {
            window.removeEventListener('storage', updateDisplayName);
        };
    }, []);

    // nickName이 변경될 때 displayName 업데이트
    useEffect(() => {
        if (nickName) {
            setDisplayName(nickName);
        } else if (userName) {
            setDisplayName(userName);
        }
    }, [nickName, userName]);

    useEffect(() => {
        const onForceLogout = () => {
            setIsLoggedIn(false);
            setUserName && setUserName('');
            setNickName && setNickName('');
            setRoles && setRoles([]);
            setPassWord('');
            setShowLogin(false);
            setDisplayName('');
            stopSessionTimer();

            // 세션 스토리지 클리어 (사용자별 데이터 초기화)
            sessionStorage.clear();

            // 즉시 홈으로 이동 (탭 리셋과 URL을 동기화하여 빈 화면 방지)
            try {
                navigate('/', { replace: true, state: { reason: '401' } });
                openAlert('인증정보가 존재하지 않습니다.');
            } catch {
                window.location.href = '/';
            }
        };

        const onOpenLogin = () => {
            setLoginUsername('');
            setPassWord('');
            setShowLogin(true);
        };

        window.addEventListener('auth:logout', onForceLogout);
        window.addEventListener('auth:login:open', onOpenLogin);

        return () => {
            window.removeEventListener('auth:logout', onForceLogout);
            window.removeEventListener('auth:login:open', onOpenLogin);
        };
    }, [setIsLoggedIn, setNickName, setUserName, setRoles, navigate, stopSessionTimer]);

    const login = async () => {
        const sendUrl = `/dart/member/login`;

        setIsLoading(true);

        const { data, error } = await send(
            sendUrl,
            {
                username: loginUsername,
                password: password,
            },
            'POST'
        );

        setIsLoading(false);

        if (error == null) {
            // 로그인 성공 처리
            const res = data.response || {};
            const nextUserName = res.username ?? loginUsername;
            const nextNick = res.nickname ?? nextUserName;
            const nextRoles = Array.isArray(res.roles) ? res.roles : [];

            localStorage.setItem('userName', nextUserName);
            localStorage.setItem('nickName', nextNick);
            localStorage.setItem('roles', JSON.stringify(nextRoles));

            setUserName(nextUserName);
            setNickName(nextNick);
            setRoles(nextRoles);
            setIsLoggedIn(true);
            setLoginUsername('');
            setPassWord('');
            setShowLogin(false);
            setDisplayName(nextNick);

            // 세션 타이머 시작 (서버에서 받은 TTL)
            const initialTTL = res.sessionTTL ?? 1800;
            startSessionTimer(initialTTL);

            // 로그인 후 공개 페이지(홈 제외)에 있다면 홈으로 이동
            const currentPath = location.pathname;
            const isPublicPage = PUBLIC_ROUTES.includes(currentPath);
            const isHomePage = currentPath === '/';

            if (isPublicPage && !isHomePage) {
                navigate('/');
            }
        } else {
            openAlert(error);
        }
    };

    const logout = async () => {
        const sendUrl = `/dart/member/logout`;

        setIsLoading(true);

        const { data, error } = await send(sendUrl, {}, 'DELETE');
        if (error == null) {
            setIsLoggedIn(false);
            setUserName('');
            setNickName('');
            setRoles([]);
            setPassWord('');
            stopSessionTimer();

            localStorage.removeItem('userName');
            localStorage.removeItem('nickName');
            localStorage.removeItem('roles');

            // 세션 스토리지 클리어 (사용자별 데이터 초기화)
            sessionStorage.clear();

            navigate('/', { replace: true, state: { reason: 'logout' } });
        } else {
            openAlert(error);
        }

        setIsLoading(false);
    };

    return (
        <>
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <div className="flex h-16 w-full items-center px-3 md:px-6">
                    <button
                        className="mr-2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                        onClick={onMenuClick}
                        onMouseEnter={onMenuHover}
                        onMouseLeave={onMenuLeave}
                        aria-label="메뉴 토글"
                    >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    <Link to={routes.Home.path} className="flex items-center gap-2">
                        <div className="flex flex-col leading-tight">
                            <span className="text-base font-bold text-slate-900 dark:text-white">{title}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">기업가치 분석 & 포트폴리오</span>
                        </div>
                    </Link>

                    <div className="ml-auto flex items-center gap-1.5 sm:gap-3 text-sm">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="p-1.5 sm:p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                            aria-label="테마 전환"
                        >
                            {isDark ? (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                </svg>
                            )}
                        </button>

                        {isLoggedIn && displayName && (
                            <div className="flex items-center gap-1 sm:gap-2">
                                {/* 세션 TTL 표시 */}
                                {sessionTTL != null && (
                                    <div className={`flex items-center gap-0.5 sm:gap-1 rounded-full px-1.5 sm:px-2 py-1 text-xs font-medium ${
                                        sessionTTL <= 300
                                            ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                    }`}>
                                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-[10px] sm:text-xs">{formatTTL(sessionTTL)}</span>
                                    </div>
                                )}
                                <Link
                                    to="/member/myprofile"
                                    className="flex items-center gap-1 sm:gap-1.5 rounded-lg px-1.5 sm:px-2 py-1 text-slate-700 md:gap-2 md:px-3 md:py-1.5 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white md:h-7 md:w-7">
                                        {displayName.charAt(0)}
                                    </div>
                                    <span className="hidden sm:inline max-w-[60px] truncate text-xs md:max-w-[120px] md:text-sm">{displayName}<span className="hidden md:inline"> 님</span></span>
                                </Link>
                            </div>
                        )}

                        {isLoggedIn ? (
                            <button
                                type="button"
                                onClick={logout}
                                className="rounded-lg border border-slate-300 p-1.5 sm:px-3 sm:py-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                                aria-label="로그아웃"
                            >
                                <span className="hidden sm:inline text-xs font-medium">로그아웃</span>
                                <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                                    onClick={() => navigate('/member/join')}
                                >
                                    회원가입
                                </button>
                                <button
                                    type="button"
                                    className="rounded-lg bg-brand px-3 sm:px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
                                    onClick={() => {
                                        setLoginUsername('');
                                        setPassWord('');
                                        setShowLogin(true);
                                    }}
                                >
                                    로그인
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {showLogin && (
                <LoginModal
                    show={showLogin}
                    onClose={() => {
                        setShowLogin(false);
                        setLoginUsername('');
                        setPassWord('');
                    }}
                    onLogin={login}
                    isLoading={isLoading}
                    username={loginUsername}
                    setUsername={setLoginUsername}
                    password={password}
                    setPassword={setPassWord}
                />
            )}

            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={handleCloseAlert}
            />
        </>
    );
}