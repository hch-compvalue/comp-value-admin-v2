import { useState, useEffect, useCallback, useRef } from 'react';
import { send } from '@/util/ClientUtil';
import useModalAnimation from '@/hooks/useModalAnimation';
import PageTitle from '@/component/common/display/PageTitle';
import Loading from '@/component/common/display/Loading';
import Button from '@/component/common/button/Button';
import AlertModal from '@/component/layouts/common/popup/AlertModal';
import ScheduleJobCard from '@/pages/admin/ScheduleJobCard';
import ExternalSchedules from '@/pages/admin/ExternalSchedules';

const JOBS_URL = '/dart/schd/jobs';
const HISTORY_LIMIT = 20;
const RUNNING_POLL_MS = 15 * 1000; // 실행 중일 때만 상태 자동 갱신

/**
 * 스케줄 관리 (관리 > 스케줄 관리, 슈퍼관리자 전용)
 * - 백엔드 배치 작업의 실행 주기·자동 실행 여부 변경(재배포 없이 즉시 반영), 지금 실행, 실행 이력
 * - 하단: 다른 곳에서 관리되는 스케줄(자동매매 전략·DB 백업) 조회 전용
 */
const ScheduleManagement = () => {
    const [jobs, setJobs] = useState([]);
    const [histories, setHistories] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [savingKey, setSavingKey] = useState(null);
    const [alertConfig, setAlertConfig] = useState({ open: false, message: '' });
    const [runTarget, setRunTarget] = useState(null);   // 닫힘 애니메이션 중에도 제목 유지를 위해 열림 여부와 분리
    const [isRunModalOpen, setIsRunModalOpen] = useState(false);
    const [maxCountInput, setMaxCountInput] = useState('0');
    const { shouldRender: renderRunModal, isAnimatingOut: isRunModalClosing } = useModalAnimation(isRunModalOpen, 250);
    const loadedOnce = useRef(false);
    const externalRef = useRef(null);

    const openAlert = useCallback((message) => setAlertConfig({ open: true, message }), []);

    const fetchHistory = useCallback(async (jobKey) => {
        const { data, error } = await send(`${JOBS_URL}/${jobKey}/history?limit=${HISTORY_LIMIT}`, {}, 'GET');
        if (!error && Array.isArray(data?.response)) {
            setHistories((prev) => ({ ...prev, [jobKey]: data.response }));
        }
    }, []);

    // 목록 + 각 작업 이력 조회 (silent: 자동 갱신 시 로딩 표시·오류 알림 생략)
    const fetchJobs = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setIsLoading(true);
        try {
            const { data, error } = await send(JOBS_URL, {}, 'GET');
            if (error || !Array.isArray(data?.response)) {
                if (!silent) openAlert(error || '스케줄 목록을 불러오지 못했습니다.');
                return;
            }
            setJobs(data.response);
            await Promise.all(data.response.map((j) => fetchHistory(j.jobKey)));
        } finally {
            if (!silent) setIsLoading(false);
            loadedOnce.current = true;
        }
    }, [fetchHistory, openAlert]);

    useEffect(() => { fetchJobs(); }, [fetchJobs]);

    // 실행 중인 작업이 있으면 주기적으로 상태 갱신 (끝나면 자동 중지)
    const anyRunning = jobs.some((j) => j.running);
    useEffect(() => {
        if (!anyRunning) return undefined;
        const timer = setInterval(() => fetchJobs({ silent: true }), RUNNING_POLL_MS);
        return () => clearInterval(timer);
    }, [anyRunning, fetchJobs]);

    const updateJob = useCallback(async (jobKey, body) => {
        setSavingKey(jobKey);
        try {
            const { data, error } = await send(`${JOBS_URL}/${jobKey}`, body, 'PUT');
            if (error) {
                openAlert(error);
                return;
            }
            setJobs((prev) => prev.map((j) => (j.jobKey === jobKey ? data.response : j)));
        } finally {
            setSavingKey(null);
        }
    }, [openAlert]);

    const handleToggle = useCallback((job) => updateJob(job.jobKey, { enabled: !job.enabled }), [updateJob]);

    const isMaxCountValid = /^\d+$/.test(maxCountInput);
    const openRunModal = useCallback((job) => { setRunTarget(job); setMaxCountInput('0'); setIsRunModalOpen(true); }, []);
    const closeRunModal = () => setIsRunModalOpen(false);

    const handleRun = useCallback(async () => {
        if (!runTarget || !isMaxCountValid) return;
        const { jobKey } = runTarget;
        const maxCount = parseInt(maxCountInput, 10);
        setIsRunModalOpen(false);
        setIsLoading(true);
        try {
            const { error } = await send(`${JOBS_URL}/${jobKey}/run`, { maxCount }, 'POST');
            if (error) openAlert(error);
            await fetchJobs({ silent: true });
        } finally {
            setIsLoading(false);
        }
    }, [runTarget, isMaxCountValid, maxCountInput, fetchJobs, openAlert]);

    return (
        <>
            <PageTitle />
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    서버에서 정해진 시각에 자동으로 도는 작업입니다. 주기를 바꾸면 <strong>재배포 없이 바로</strong> 적용됩니다.
                </p>
                <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => { fetchJobs(); externalRef.current?.refresh(); }}>새로고침</Button>
            </div>

            <Loading show={isLoading} />

            <div className="space-y-4">
                {jobs.length === 0 && loadedOnce.current && !isLoading && (
                    <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                        관리 중인 스케줄이 없습니다.
                    </p>
                )}
                {jobs.map((job) => (
                    <ScheduleJobCard
                        key={job.jobKey}
                        job={job}
                        history={histories[job.jobKey] || []}
                        saving={savingKey === job.jobKey}
                        onToggle={handleToggle}
                        onSave={updateJob}
                        onRun={openRunModal}
                    />
                ))}
            </div>

            <ExternalSchedules ref={externalRef} />

            <AlertModal open={alertConfig.open} message={alertConfig.message} onClose={() => setAlertConfig({ open: false, message: '' })} />

            {/* 지금 실행 확인 모달 */}
            {renderRunModal && (
                <div className={`fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 px-4 animate__animated ${isRunModalClosing ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }} onClick={closeRunModal}>
                    <div
                        className={`w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800 animate__animated ${isRunModalClosing ? 'animate__fadeOut' : 'animate__fadeIn'}`} style={{ animationDuration: '0.25s' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{runTarget?.label} 지금 실행</h3>
                        <label className="mb-2 block text-sm text-slate-700 dark:text-slate-300">처리 건수 (프로파일별)</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={maxCountInput}
                            onChange={(e) => { if (e.target.value === '' || /^\d+$/.test(e.target.value)) setMaxCountInput(e.target.value); }}
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            placeholder="0 = 전체"
                        />
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">0: 전체 실행 / 그 외: 테스트용 (지정 건수만 처리)</p>
                        {maxCountInput === '0' && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                전체 실행은 약 4시간 걸리고 FMP 호출을 많이 씁니다. 실행 중에는 백엔드 배포를 하지 마세요.
                            </p>
                        )}
                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="secondary" onClick={closeRunModal}>취소</Button>
                            <Button disabled={!isMaxCountValid} onClick={handleRun}>실행</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ScheduleManagement;
