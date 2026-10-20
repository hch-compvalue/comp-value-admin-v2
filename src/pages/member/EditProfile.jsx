import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { send } from '@/util/ClientUtil';
import PageTitle from '@/component/common/display/PageTitle';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import Button from '@/component/common/button/Button';

export default function EditProfile() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null, onAfterClose: null });
    const [formData, setFormData] = useState({
        email: '',
        nickname: ''
    });
    const [originalData, setOriginalData] = useState({
        email: '',
        nickname: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [changingPassword, setChangingPassword] = useState(false);

    const openAlert = (message, onConfirm = null, onAfterClose = null) => {
        setAlertConfig({ open: true, message, onConfirm, onAfterClose });
    };

    useEffect(() => {
        fetchUserInfo();
    }, []);

    const fetchUserInfo = async () => {
        setLoading(true);
        try {
            const { data, error } = await send('/dart/member/me/info', {}, 'GET');
            if (error) {
                openAlert('회원 정보를 불러오는데 실패했습니다.');
            } else if (data?.success && data?.response) {
                const userInfo = data.response;
                const userData = {
                    email: userInfo.email || '',
                    nickname: userInfo.nickname || ''
                };
                setFormData(userData);
                setOriginalData(userData);
            }
        } catch (e) {
            console.error('회원 정보 조회 실패:', e);
            openAlert('회원 정보를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handlePasswordChange = (field, value) => {
        setPasswordData(prev => ({ ...prev, [field]: value }));
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();

        // 유효성 검사
        if (!passwordData.currentPassword) {
            openAlert('현재 비밀번호를 입력해주세요.');
            return;
        }

        if (!passwordData.newPassword) {
            openAlert('새 비밀번호를 입력해주세요.');
            return;
        }

        if (passwordData.newPassword.length < 8) {
            openAlert('새 비밀번호는 8자 이상이어야 합니다.');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            openAlert('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        if (passwordData.currentPassword === passwordData.newPassword) {
            openAlert('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
            return;
        }

        // 비밀번호 변경 확인
        openAlert('비밀번호를 변경하시겠습니까?', async () => {
            setChangingPassword(true);
            try {
                const { data, error } = await send('/dart/member/password', {
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                }, 'POST');

                if (error) {
                    setTimeout(() => {
                        openAlert(error);
                    }, 100);
                } else if (data?.success) {
                    // 비밀번호 변경 성공
                    setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                    });
                    setTimeout(() => {
                        openAlert('비밀번호가 변경되었습니다.');
                    }, 100);
                } else {
                    setTimeout(() => {
                        openAlert('비밀번호 변경에 실패했습니다.');
                    }, 100);
                }
            } catch (e) {
                console.error('비밀번호 변경 실패:', e);
                setTimeout(() => {
                    openAlert('비밀번호 변경 중 오류가 발생했습니다.');
                }, 100);
            } finally {
                setChangingPassword(false);
            }
        });
    };

    const handleCancel = () => {
        navigate('/member/myprofile');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 유효성 검사
        if (!formData.email.trim()) {
            openAlert('이메일을 입력해주세요.');
            return;
        }

        // 이메일 형식 검사
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            openAlert('올바른 이메일 형식을 입력해주세요.');
            return;
        }

        if (!formData.nickname.trim()) {
            openAlert('닉네임을 입력해주세요.');
            return;
        }

        // 변경사항 확인
        if (formData.email === originalData.email && formData.nickname === originalData.nickname) {
            openAlert('변경된 정보가 없습니다.');
            return;
        }

        // 수정 확인 모달
        openAlert('회원정보를 수정하시겠습니까?', async () => {
            setSaving(true);
            try {
                const { data, error } = await send('/dart/member/update', {
                    email: formData.email.trim(),
                    nickname: formData.nickname.trim()
                }, 'POST');

                if (error) {
                    openAlert(error);
                } else if (data?.success) {
                    // localStorage 업데이트
                    if (data.response?.email) {
                        localStorage.setItem('email', data.response.email);
                    }
                    if (data.response?.nickname) {
                        localStorage.setItem('nickName', data.response.nickname);
                    }

                    // 헤더 업데이트를 위한 이벤트 발생
                    window.dispatchEvent(new Event('storage'));

                    openAlert('회원정보가 수정되었습니다.', null, () => navigate('/member/myprofile'));
                } else {
                    openAlert('회원정보 수정에 실패했습니다.');
                }
            } catch (e) {
                console.error('회원정보 수정 실패:', e);
                openAlert('회원정보 수정 중 오류가 발생했습니다.');
            } finally {
                setSaving(false);
            }
        });
    };

    if (loading) {
        return (
            <>
                <PageTitle />
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">회원 정보를 불러오는 중...</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <PageTitle />

            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* 헤더 */}
                <div className="mb-6">
                    <button
                        onClick={handleCancel}
                        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-4 transition-colors whitespace-nowrap"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-sm font-medium">내정보로 돌아가기</span>
                    </button>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">회원정보 수정</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2">이메일과 닉네임을 변경할 수 있습니다</p>
                </div>

                {/* 수정 폼 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">기본 정보</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* 이메일 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                이메일 <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                placeholder="example@email.com"
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white transition-colors"
                                disabled={saving}
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                이메일 주소를 정확히 입력해주세요
                            </p>
                        </div>

                        {/* 닉네임 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                닉네임 <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.nickname}
                                onChange={(e) => handleChange('nickname', e.target.value)}
                                placeholder="닉네임을 입력하세요"
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white transition-colors"
                                disabled={saving}
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                다른 사용자에게 표시될 이름입니다
                            </p>
                        </div>

                        {/* 안내 메시지 */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <div className="flex gap-3">
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-sm text-blue-800 dark:text-blue-300">
                                    <p className="font-medium mb-1">수정 가능한 정보</p>
                                    <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
                                        <li>이메일 주소</li>
                                        <li>닉네임</li>
                                    </ul>
                                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                                        사용자 ID와 권한은 변경할 수 없습니다
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 버튼 */}
                        <div className="flex items-center gap-3 pt-4">
                            <Button variant="secondary" type="button" onClick={handleCancel} disabled={saving} className="flex-1">
                                취소
                            </Button>
                            <Button type="submit" disabled={saving} className="flex-1">
                                {saving ? '저장 중...' : '저장'}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* 비밀번호 변경 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mt-6">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">비밀번호 변경</h2>
                    </div>

                    <form onSubmit={handlePasswordSubmit} className="p-6 space-y-6">
                        {/* 현재 비밀번호 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                현재 비밀번호 <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="password"
                                value={passwordData.currentPassword}
                                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                                placeholder="현재 비밀번호를 입력하세요"
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white transition-colors"
                                disabled={changingPassword}
                            />
                        </div>

                        {/* 새 비밀번호 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                새 비밀번호 <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                                placeholder="새 비밀번호를 입력하세요 (최소 8자)"
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white transition-colors"
                                disabled={changingPassword}
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                비밀번호는 최소 8자 이상이어야 합니다
                            </p>
                        </div>

                        {/* 새 비밀번호 확인 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                새 비밀번호 확인 <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                                placeholder="새 비밀번호를 다시 입력하세요"
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white transition-colors"
                                disabled={changingPassword}
                            />
                        </div>

                        {/* 안내 메시지 */}
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                            <div className="flex gap-3">
                                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div className="text-sm text-amber-800 dark:text-amber-300">
                                    <p className="font-medium mb-1">비밀번호 변경 시 주의사항</p>
                                    <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-400">
                                        <li>안전한 비밀번호를 사용하세요</li>
                                        <li>영문, 숫자, 특수문자를 조합하는 것을 권장합니다</li>
                                        <li>다른 사이트와 동일한 비밀번호는 사용하지 마세요</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 버튼 */}
                        <div className="flex items-center gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })}
                                disabled={changingPassword}
                                className="flex-1 px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                초기화
                            </button>
                            <button
                                type="submit"
                                disabled={changingPassword}
                                className="flex-1 px-6 py-2.5 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {changingPassword ? '변경 중...' : '비밀번호 변경'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <AlertModal
                open={alertConfig.open}
                message={alertConfig.message}
                onClose={() => setAlertConfig({ open: false, message: '', onConfirm: null, onAfterClose: null })}
                onConfirm={alertConfig.onConfirm}
                onAfterClose={alertConfig.onAfterClose}
            />
        </>
    );
}
