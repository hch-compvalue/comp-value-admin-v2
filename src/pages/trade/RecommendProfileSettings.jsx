import { useState, useEffect, useCallback, useMemo } from 'react';
import { send } from '@/util/ClientUtil';
import useModalAnimation from '@/hooks/useModalAnimation';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import PageTitle from '@/component/common/display/PageTitle';
import Loading from '@/component/common/display/Loading';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import ProfileSettingModal from '@/pages/trade/popup/ProfileSettingModal';

// 로컬스토리지 키 (마지막 수동 실행 시각 표시용)
const SCHEDULE_RUN_KEY = 'lastRecommendedStockScheduleRun';
const SCHEDULE_RUN_DISPLAY_HOURS = 1; // 수동 실행 시각은 1시간 동안만 표시
const MS_PER_HOUR = 60 * 60 * 1000;

const loadLastScheduleRun = () => {
    try {
        const stored = localStorage.getItem(SCHEDULE_RUN_KEY);
        if (!stored) return null;
        const runTime = new Date(stored);
        if ((Date.now() - runTime) / MS_PER_HOUR >= SCHEDULE_RUN_DISPLAY_HOURS) {
            localStorage.removeItem(SCHEDULE_RUN_KEY);
            return null;
        }
        return runTime;
    } catch {
        return null;
    }
};

/**
 * 추천 프로파일 설정 (슈퍼관리자 전용 탭)
 * - 매일 10시 추천 스케줄이 쓰는 스크리닝 조건(프로파일) 관리 + 스케줄 수동 실행
 * - 추천 결과 조회는 "오늘의 매수후보" 탭의 추천 프로파일 필터로 대체 (2026-10 통합)
 */
const RecommendProfileSettings = () => {
    const [profiles, setProfiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const { shouldRender: renderScheduleModal, isAnimatingOut: isScheduleModalClosing } = useModalAnimation(showScheduleModal, 250);
    const [maxCountInput, setMaxCountInput] = useState('');
    const [lastScheduleRun, setLastScheduleRun] = useState(loadLastScheduleRun);

    // 필터 옵션 조회 (거래소 등 - 프로파일 폼용)
    const { options: filterOptions, loading: filterOptionsLoading } = useFilterOptions();

    const openAlert = useCallback((message, onConfirm) => {
        setAlertConfig({ open: true, message, onConfirm: onConfirm || null });
    }, []);

    const handleCloseAlert = useCallback(() => {
        const { onConfirm } = alertConfig;
        setAlertConfig({ open: false, message: '', onConfirm: null });
        if (onConfirm) onConfirm();
    }, [alertConfig]);

    // 전체 프로파일 목록 조회
    const fetchProfiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await send('/dart/recommend/profile', {}, 'GET');
            if (!error && Array.isArray(data?.response)) {
                setProfiles(data.response);
            } else {
                setProfiles([]);
                openAlert('프로파일 목록을 불러오지 못했습니다.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [openAlert]);

    useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

    // 활성 → 정렬순 (스케줄이 도는 순서와 동일하게)
    const sortedProfiles = useMemo(() => [...profiles].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive === 'Y' ? -1 : 1;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    }), [profiles]);

    // maxCount 입력값 유효성 검사
    const isMaxCountValid = maxCountInput !== '' && /^\d+$/.test(maxCountInput);

    // 추천기업 스케줄 수동 실행
    const handleRunSchedule = useCallback(async () => {
        if (!isMaxCountValid) return;

        const maxCount = parseInt(maxCountInput, 10);
        setIsLoading(true);
        setShowScheduleModal(false);
        try {
            const { data, error } = await send('/dart/schd/recommended-stocks', { maxCount }, 'POST');
            if (error) {
                openAlert(data?.code === '40301' ? '접근 권한이 없습니다.' : (data?.message || '스케줄 실행 중 오류가 발생했습니다.'));
            } else {
                const now = new Date();
                try { localStorage.setItem(SCHEDULE_RUN_KEY, now.toISOString()); } catch { /* 저장 실패 무시 */ }
                setLastScheduleRun(now);
                openAlert(`추천기업 조회 스케줄이 실행되었습니다.\n(maxCount=${maxCount})`);
            }
        } finally {
            setIsLoading(false);
            setMaxCountInput('');
        }
    }, [maxCountInput, isMaxCountValid, openAlert]);

    return (
        <>
            <PageTitle />
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    매일 오전 10시 추천 스케줄이 <strong>활성 프로파일</strong> 조건으로 종목을 뽑고, 이어서 전수 평가합니다.
                    결과는 <strong>오늘의 매수후보</strong> 탭에서 프로파일별로 볼 수 있습니다.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                    {lastScheduleRun && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                            마지막 수동 실행: {lastScheduleRun.toLocaleString('ko-KR')}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowProfileModal(true)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg border border-sky-600 bg-white text-sky-700 text-xs font-medium hover:bg-sky-50 transition-colors disabled:opacity-50 dark:bg-slate-800 dark:border-sky-500 dark:text-sky-400 dark:hover:bg-slate-700"
                    >
                        프로파일 편집
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowScheduleModal(true)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors disabled:opacity-50"
                    >
                        추천기업 조회 실행
                    </button>
                </div>
            </div>

            <Loading show={isLoading} />

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                            {['상태', '순서', '프로파일명', '설명', '섹터 쿼터'].map((h) => (
                                <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedProfiles.length === 0 && !isLoading && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">등록된 프로파일이 없습니다.</td></tr>
                        )}
                        {sortedProfiles.map((p) => (
                            <tr key={p.id} className={`border-t border-slate-100 dark:border-slate-800 ${p.isActive === 'Y' ? '' : 'opacity-60'}`}>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                    {/* 적록색약 고려: 활성=파랑, 비활성=회색 */}
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.isActive === 'Y'
                                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200'
                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                        {p.isActive === 'Y' ? '활성' : '비활성'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.sortOrder ?? '-'}</td>
                                <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white whitespace-nowrap">{p.profileName}</td>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.profileDesc || '-'}</td>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.sectorQuotaPct != null ? `${p.sectorQuotaPct}%` : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AlertModal open={alertConfig.open} message={alertConfig.message} onClose={handleCloseAlert} />

            {/* 추천기업 조회 스케줄 모달 */}
            {renderScheduleModal && (
                <>
                    <div className={`fixed inset-0 z-[70] bg-black/50 dark:bg-black/70 animate__animated ${isScheduleModalClosing ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }} onClick={() => setShowScheduleModal(false)} />
                    <div
                        className={`fixed z-[80] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(360px,calc(100vw-32px))] rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-800 animate__animated ${isScheduleModalClosing ? 'animate__zoomOut' : 'animate__zoomIn'}`} style={{ animationDuration: '0.25s' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">추천기업 조회 실행</h3>
                        <div className="mb-4">
                            <label className="block text-sm text-slate-600 dark:text-slate-300 mb-2">조회 건수 (maxCount)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={maxCountInput}
                                onChange={(e) => {
                                    // 숫자만 허용 (빈 문자열도 허용)
                                    if (e.target.value === '' || /^\d+$/.test(e.target.value)) setMaxCountInput(e.target.value);
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                placeholder="숫자를 입력하세요 (0 = 전체 조회)"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                0: 전체 조회 / 그 외: 테스트용 (지정 건수만큼 조회)
                            </p>
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                전체 조회는 약 4시간 걸리며, 끝나면 매수후보 평가까지 자동으로 이어집니다.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setShowScheduleModal(false); setMaxCountInput(''); }}
                                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleRunSchedule}
                                disabled={!isMaxCountValid}
                                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                실행
                            </button>
                        </div>
                    </div>
                </>
            )}

            <ProfileSettingModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                profiles={profiles}
                onRefresh={fetchProfiles}
                openAlert={openAlert}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                send={send}
                filterOptions={filterOptions}
                filterOptionsLoading={filterOptionsLoading}
            />
        </>
    );
};

export default RecommendProfileSettings;
