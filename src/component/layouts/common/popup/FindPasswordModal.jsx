import { useState, useEffect } from 'react';

import Input from '@/component/common/input/Input';
import useModalAnimation from '@/hooks/useModalAnimation';
import Loading from '@/component/common/display/Loading';
import AlertModal from './AlertModal';
import { send } from '@/util/ClientUtil';

export default function FindPasswordModal({ show, onClose }) {
    const [step, setStep] = useState(1); // 1: 회원정보 입력, 2: 인증코드 입력, 3: 임시비밀번호 표시
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [temporaryPassword, setTemporaryPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '' });
    const [remainingTime, setRemainingTime] = useState(300); // 5분 = 300초
    const [timerActive, setTimerActive] = useState(false);

    // 타이머 효과
    useEffect(() => {
        let interval;
        if (timerActive && remainingTime > 0) {
            interval = setInterval(() => {
                setRemainingTime(prev => {
                    if (prev <= 1) {
                        setTimerActive(false);
                        setAlertConfig({
                            open: true,
                            message: '인증코드가 만료되었습니다. 다시 요청해주세요.'
                        });
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerActive, remainingTime]);

    // 모달이 닫힐 때 모든 상태 초기화
    useEffect(() => {
        if (!show) {
            setStep(1);
            setUsername('');
            setEmail('');
            setVerificationCode('');
            setTemporaryPassword('');
            setRemainingTime(300);
            setTimerActive(false);
        }
    }, [show]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleRequestReset = async () => {
        if (!username) {
            setAlertConfig({ open: true, message: '아이디를 입력해주세요.' });
            return;
        }
        if (!email) {
            setAlertConfig({ open: true, message: '이메일을 입력해주세요.' });
            return;
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setAlertConfig({ open: true, message: '올바른 이메일 형식을 입력해주세요.' });
            return;
        }

        setIsLoading(true);

        const { data, error } = await send(
            '/dart/member/password/reset/request',
            { username, email },
            'POST'
        );

        setIsLoading(false);

        if (error == null) {
            if (data.success && data.response) {
                setAlertConfig({ open: true, message: data.message });
                setStep(2);
                // 백엔드에서 받은 만료시간(초) 사용
                const expiresInSeconds = data.response.expiresInSeconds || 300;
                setRemainingTime(expiresInSeconds);
                setTimerActive(true);
            } else {
                setAlertConfig({ open: true, message: data.message });
            }
        } else {
            setAlertConfig({ open: true, message: error });
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode) {
            setAlertConfig({ open: true, message: '인증코드를 입력해주세요.' });
            return;
        }

        setIsLoading(true);

        const { data, error } = await send(
            '/dart/member/password/reset/verify',
            { username, email, verificationCode },
            'POST'
        );

        setIsLoading(false);

        if (error == null) {
            if (data.success && data.response) {
                setTimerActive(false);
                setTemporaryPassword(data.response.temporaryPassword);
                setStep(3);
            } else {
                setAlertConfig({ open: true, message: data.message });
            }
        } else {
            setAlertConfig({ open: true, message: error });
        }
    };

    const handleClose = () => {
        setStep(1);
        setUsername('');
        setEmail('');
        setVerificationCode('');
        setTemporaryPassword('');
        setRemainingTime(300);
        setTimerActive(false);
        onClose();
    };

    const { shouldRender, isAnimatingOut } = useModalAnimation(show);

    if (!shouldRender) return null;

    const handleOutsideClick = (e) => {
        if (e.target.classList.contains('find-password-modal-overlay')) {
            handleClose();
        }
    };

    return (
        <div
            className={`find-password-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', animationDuration: '0.25s' }}
            onClick={handleOutsideClick}
        >
            <Loading show={isLoading} />
            <div className={`relative w-full max-w-md max-h-[85vh] overflow-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl ring-1 ring-slate-900/5 md:p-6 dark:bg-slate-800 dark:text-white dark:ring-slate-700 animate__animated ${isAnimatingOut ? 'animate__fadeOutDown' : 'animate__fadeInUp'}`} style={{ animationDuration: '0.25s' }}>
                {/* 상단 닫기 버튼 */}
                <button
                    type="button"
                    onClick={handleClose}
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
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">비밀번호 찾기</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {step === 1 && '아이디와 이메일을 입력해주세요.'}
                            {step === 2 && '이메일로 전송된 인증코드를 입력해주세요.'}
                            {step === 3 && '임시 비밀번호가 발급되었습니다.'}
                        </p>
                    </div>
                </div>

                {/* Step 1: 회원정보 입력 */}
                {step === 1 && (
                    <>
                        <div className="space-y-3">
                            <Input
                                label="아이디"
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                onEnter={handleRequestReset}
                                wdfull={true}
                            />
                            <Input
                                label="이메일"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onEnter={handleRequestReset}
                                wdfull={true}
                                placeholder="example@email.com"
                            />
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-200"
                            >
                                닫기
                            </button>
                            <button
                                type="button"
                                onClick={handleRequestReset}
                                className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
                                disabled={isLoading}
                            >
                                인증코드 전송
                            </button>
                        </div>
                    </>
                )}

                {/* Step 2: 인증코드 입력 */}
                {step === 2 && (
                    <>
                        <div className="space-y-3">
                            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 border border-blue-200 dark:border-blue-800">
                                <p className="text-xs text-blue-900 dark:text-blue-100 mb-1">
                                    {email} 주소로 인증코드가 전송되었습니다.
                                </p>
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    <span className={`text-sm font-semibold ${remainingTime <= 60 ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                        남은 시간: {formatTime(remainingTime)}
                                    </span>
                                </div>
                            </div>

                            <Input
                                label="인증코드"
                                type="text"
                                value={verificationCode}
                                onChange={e => setVerificationCode(e.target.value)}
                                onEnter={handleVerifyCode}
                                wdfull={true}
                                placeholder="6자리 인증코드"
                            />
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setStep(1);
                                    setVerificationCode('');
                                    setTimerActive(false);
                                }}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-200"
                            >
                                이전
                            </button>
                            <button
                                type="button"
                                onClick={handleVerifyCode}
                                className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
                                disabled={isLoading || remainingTime === 0}
                            >
                                인증하기
                            </button>
                        </div>
                    </>
                )}

                {/* Step 3: 임시비밀번호 표시 */}
                {step === 3 && (
                    <>
                        <div className="space-y-3">
                            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                        임시 비밀번호가 발급되었습니다
                                    </p>
                                </div>

                                <div className="bg-white dark:bg-slate-700 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                                    <div className="mb-2">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">아이디</span>
                                        <p className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">{username}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">임시 비밀번호</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400 tracking-wide">
                                                {temporaryPassword}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(temporaryPassword);
                                                    setAlertConfig({ open: true, message: '임시 비밀번호가 클립보드에 복사되었습니다.' });
                                                }}
                                                className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-400"
                                                title="복사"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <p>
                                        임시 비밀번호로 로그인한 후 반드시 새로운 비밀번호로 변경해주세요.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
                            >
                                확인
                            </button>
                        </div>
                    </>
                )}
            </div>

            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={() => setAlertConfig({ open: false, message: '' })}
            />
        </div>
    );
}
