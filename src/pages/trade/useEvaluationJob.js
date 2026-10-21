import { useCallback, useEffect, useRef, useState } from 'react';
import { send } from '@/util/ClientUtil';

const JOBS_API = '/dart/main/evaluate/jobs';
// 진행 중 작업 결과를 받아오는 주기
const POLL_MS = 2000;

export const JOB_STATUS = {
    RUNNING: 'RUNNING',
    DONE: 'DONE',
    CANCELLED: 'CANCELLED',
    INTERRUPTED: 'INTERRUPTED',
    FAILED: 'FAILED',
};

export const JOB_STATUS_LABEL = {
    [JOB_STATUS.RUNNING]: '진행 중',
    [JOB_STATUS.DONE]: '완료',
    [JOB_STATUS.CANCELLED]: '중지됨',
    [JOB_STATUS.INTERRUPTED]: '중단됨',
    [JOB_STATUS.FAILED]: '실패',
};

/** 응답에서 결과 목록을 뺀 작업 상태만 */
const metaOf = (job) => {
    const meta = { ...job };
    delete meta.results;
    delete meta.resultsFrom;
    return meta;
};

/**
 * 일괄 평가 서버 작업 (시작 → 2초마다 새 결과 받기 → 끝나면 멈춤)
 * - 페이지를 다시 열면 진행 중 작업을 이어받고, 끝난 작업은 lastJob 으로 알려줌 (결과는 loadLast 로 불러옴)
 * @param {(rows: object[], replace: boolean) => void} onResults 받은 결과 전달 (replace=true 면 표를 새로 채움)
 */
export default function useEvaluationJob(onResults) {
    const [job, setJob] = useState(null);         // 지금 화면이 따라가는 작업
    const [lastJob, setLastJob] = useState(null); // 화면에 불러오지 않은 지난 작업
    const receivedRef = useRef(0);
    const timerRef = useRef(null);
    const onResultsRef = useRef(onResults);
    onResultsRef.current = onResults;

    const isRunning = job?.status === JOB_STATUS.RUNNING;

    const fetchCurrent = useCallback(async (from) => {
        const { data, error } = await send(`${JOBS_API}/current?from=${from}`, {}, 'GET');
        return error ? { error } : { job: data?.response ?? null };
    }, []);

    // 진행 중이면 주기적으로 새 결과만 받아 이어 붙임
    useEffect(() => {
        if (!isRunning) return undefined;
        let stopped = false;
        const tick = async () => {
            const { job: current } = await fetchCurrent(receivedRef.current);
            if (stopped || !current) return;
            if (current.results?.length) {
                receivedRef.current += current.results.length;
                onResultsRef.current(current.results, false);
            }
            setJob(metaOf(current));
            if (current.status === JOB_STATUS.RUNNING) timerRef.current = setTimeout(tick, POLL_MS);
        };
        timerRef.current = setTimeout(tick, POLL_MS);
        return () => {
            stopped = true;
            clearTimeout(timerRef.current);
        };
    }, [isRunning, fetchCurrent]);

    // 처음 열 때: 진행 중이면 이어받기, 끝난 작업이면 알림만
    useEffect(() => {
        (async () => {
            const { job: current } = await fetchCurrent(0);
            if (!current) return;
            if (current.status === JOB_STATUS.RUNNING) {
                receivedRef.current = current.results?.length ?? 0;
                onResultsRef.current(current.results ?? [], true);
                setJob(metaOf(current));
            } else {
                setLastJob(metaOf(current));
            }
        })();
    }, [fetchCurrent]);

    /** 작업 시작 — 실패하면 { error } */
    const start = useCallback(async (symbols) => {
        const { data, error } = await send(JOBS_API, { symbols }, 'POST');
        if (error || !data?.response) return { error: error || '일괄 평가를 시작하지 못했습니다.' };
        receivedRef.current = 0;
        setLastJob(null);
        setJob(data.response);
        return { job: data.response };
    }, []);

    const cancel = useCallback(async () => {
        const { error } = await send(`${JOBS_API}/current/cancel`, {}, 'POST');
        if (error) return { error };
        setJob((j) => (j ? { ...j, cancelling: true } : j));
        return {};
    }, []);

    /** 지난 작업 결과를 표로 불러오기 */
    const loadLast = useCallback(async () => {
        const { job: current, error } = await fetchCurrent(0);
        if (error || !current) return { error: error || '불러올 결과가 없습니다.' };
        receivedRef.current = current.results?.length ?? 0;
        onResultsRef.current(current.results ?? [], true);
        setJob(metaOf(current));
        setLastJob(null);
        return {};
    }, [fetchCurrent]);

    /** 진행 표시 닫기 (끝난 작업) */
    const dismiss = useCallback(() => setJob((j) => (j?.status === JOB_STATUS.RUNNING ? j : null)), []);

    return { job, lastJob, isRunning, start, cancel, loadLast, dismiss };
}
