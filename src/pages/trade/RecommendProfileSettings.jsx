import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { send } from '@/util/ClientUtil';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import PageTitle from '@/component/common/display/PageTitle';
import Loading from '@/component/common/display/Loading';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import ProfileSettingModal from '@/pages/trade/popup/ProfileSettingModal';
import { SCHEDULE_MANAGEMENT_PATH } from '@/config/menuPaths';

/**
 * 추천 프로파일 설정 (슈퍼관리자 전용 탭)
 * - 추천 스케줄이 쓰는 스크리닝 조건(프로파일) 관리
 * - 스케줄 실행·주기 변경은 관리 > 스케줄 관리 (2026-10 이전)
 * - 추천 결과 조회는 "오늘의 매수후보" 탭의 추천 프로파일 필터로 대체 (2026-10 통합)
 */
const RecommendProfileSettings = () => {
    const [profiles, setProfiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '', onConfirm: null });
    const [showProfileModal, setShowProfileModal] = useState(false);
    const navigate = useNavigate();

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

    return (
        <>
            <PageTitle />
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    추천 스케줄이 <strong>활성 프로파일</strong> 조건으로 종목을 뽑고, 이어서 전수 평가합니다.
                    결과는 <strong>오늘의 매수후보</strong> 탭에서 프로파일별로 볼 수 있습니다.
                </p>
                <div className="flex items-center gap-2 shrink-0">
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
                        onClick={() => navigate(SCHEDULE_MANAGEMENT_PATH)}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors"
                    >
                        스케줄 관리 (실행·주기)
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
