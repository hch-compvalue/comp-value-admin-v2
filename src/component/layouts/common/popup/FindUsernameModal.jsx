import { useState } from 'react';

import Input from '@/component/common/input/Input';
import useModalAnimation from '@/hooks/useModalAnimation';
import Button from '@/component/common/button/Button';
import Loading from '@/component/common/display/Loading';
import AlertModal from './AlertModal';
import { send } from '@/util/ClientUtil';

export default function FindUsernameModal({ show, onClose }) {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [foundUsernames, setFoundUsernames] = useState(null);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '' });

    const handleFindUsername = async () => {
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
            '/dart/member/find-usernames',
            { email },
            'POST'
        );

        setIsLoading(false);

        if (error == null) {
            const usernames = data.response || [];
            if (usernames.length === 0) {
                setAlertConfig({ open: true, message: '해당 이메일로 가입된 아이디가 없습니다.' });
            } else {
                setFoundUsernames(usernames);
            }
        } else {
            setAlertConfig({ open: true, message: error });
        }
    };

    const handleClose = () => {
        setEmail('');
        setFoundUsernames(null);
        onClose();
    };

    const { shouldRender, isAnimatingOut } = useModalAnimation(show);

    if (!shouldRender) return null;

    const handleOutsideClick = (e) => {
        if (e.target.classList.contains('find-username-modal-overlay')) {
            handleClose();
        }
    };

    return (
        <div
            className={`find-username-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate__animated ${isAnimatingOut ? 'animate__fadeOut' : 'animate__fadeIn'}`}
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
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">아이디 찾기</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            가입 시 등록한 이메일 주소를 입력해주세요.
                        </p>
                    </div>
                </div>

                {foundUsernames === null ? (
                    <>
                        {/* 이메일 입력 영역 */}
                        <div className="space-y-3">
                            <Input
                                label="이메일"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onEnter={handleFindUsername}
                                wdfull={true}
                                placeholder="example@email.com"
                            />
                        </div>

                        {/* 버튼 영역 */}
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
                                onClick={handleFindUsername}
                                className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
                                disabled={isLoading}
                            >
                                아이디 찾기
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* 결과 표시 영역 */}
                        <div className="space-y-3">
                            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                                    등록된 아이디 목록
                                </p>
                                <div className="space-y-2">
                                    {foundUsernames.map((username, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 px-3 py-2 rounded-md bg-white dark:bg-slate-700 border border-blue-100 dark:border-blue-800"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                            </svg>
                                            <span className="font-mono text-sm text-slate-900 dark:text-slate-100">{username}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 버튼 영역 */}
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
