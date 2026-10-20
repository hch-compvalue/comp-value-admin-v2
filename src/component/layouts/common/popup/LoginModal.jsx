import { useEffect, useRef, useState } from 'react'

import Input from '@/component/common/input/Input';
import useModalAnimation from '@/hooks/useModalAnimation';
import Button from '@/component/common/button/Button';
import Loading from '@/component/common/display/Loading';
import AlertModal from './AlertModal';
import FindUsernameModal from './FindUsernameModal';
import FindPasswordModal from './FindPasswordModal';

export default function LoginModal({
    show,
    onClose,
    onLogin,
    isLoading,
    username,
    setUsername,
    password,
    setPassword,
}) {

    const usernameRef = useRef(null);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '' });
    const [showFindUsername, setShowFindUsername] = useState(false);
    const [showFindPassword, setShowFindPassword] = useState(false);

    useEffect(() => {
        if (show && usernameRef.current) {
            usernameRef.current.focus();
        }
    }, [show]);

    const [keyboardOffset, setKeyboardOffset] = useState(0);

    useEffect(() => {
        const handleResize = () => {
            const visualViewport = window.visualViewport;
            if (visualViewport) {
                const offset = window.innerHeight - visualViewport.height;
                setKeyboardOffset(offset > 0 ? offset : 0);
            }
        };
        window.visualViewport?.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, []);

    const { shouldRender, isAnimatingOut } = useModalAnimation(show);

    // show가 false일 경우 아무것도 렌더링하지 않음
    if (!shouldRender) return null;

    const handleOutsideClick = (e) => {
        if (e.target.classList.contains('login-modal-overlay')) {
            onClose();
        }
    };

    return (
        <div
            className={`login-modal-overlay fixed inset-0 z-50 flex justify-center p-4 overflow-y-auto animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
            style={{
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                paddingBottom: keyboardOffset ? keyboardOffset + 16 : 16,
                alignItems: keyboardOffset ? 'flex-end' : 'center',
                animationDuration: '0.25s',
            }}
            onClick={handleOutsideClick}
        >
            <Loading show={isLoading} />
            <div className={`relative w-full max-w-md max-h-[85vh] overflow-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl ring-1 ring-slate-900/5 md:p-6 dark:bg-slate-800 dark:text-white dark:ring-slate-700 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`} style={{ animationDuration: '0.25s' }}>
                {/* 상단 닫기 버튼 */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    aria-label="닫기"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>

                {/* 헤더 영역 */}
                <div className="mb-5">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">CompValue 로그인</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            보유 종목 관리와 기업가치 분석 기능을 이용하려면 로그인이 필요합니다.
                        </p>
                    </div>
                </div>

                {/* 입력 영역 */}
                <div className="space-y-3">
                    <Input
                        inputRef={usernameRef}
                        label="아이디"
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        onEnter={onLogin}
                        wdfull={true}
                    />
                    <Input
                        label="비밀번호"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onEnter={onLogin}
                        wdfull={true}
                    />
                </div>

                {/* 아이디/비밀번호 찾기 링크 */}
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <button
                        type="button"
                        onClick={() => setShowFindUsername(true)}
                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                    >
                        아이디 찾기
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                        type="button"
                        onClick={() => setShowFindPassword(true)}
                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                    >
                        비밀번호 찾기
                    </button>
                </div>

                {/* 버튼 영역 */}
                <div className="mt-5 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-200"
                    >
                        닫기
                    </button>
                    <button
                        type="button"
                        onClick={onLogin}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
                        disabled={isLoading}
                    >
                        로그인
                    </button>
                </div>
            </div>

            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={() => setAlertConfig({ open: false, message: '' })}
            />

            <FindUsernameModal
                show={showFindUsername}
                onClose={() => setShowFindUsername(false)}
            />

            <FindPasswordModal
                show={showFindPassword}
                onClose={() => setShowFindPassword(false)}
            />
        </div>
    );
}