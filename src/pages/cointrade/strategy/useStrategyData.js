import { useState, useEffect, useCallback } from 'react';
import { send } from '@/util/ClientUtil';
import { RUN_LIMIT, STATUS_REFRESH_MS, TOAST_MS, strategyUrl } from './strategyCommon';

/**
 * 전략 1개의 상태·실행 기록 조회 + 설정 변경 (코인/주식 탭 공용)
 * 상태는 STATUS_REFRESH_MS마다 자동 갱신한다.
 */
export default function useStrategyData(strategyId) {
    const [status, setStatus] = useState(null);
    const [runs, setRuns] = useState([]);
    const [toast, setToast] = useState(null);
    const [busy, setBusy] = useState(false);
    const [capitalInput, setCapitalInput] = useState('');

    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), TOAST_MS);
    }, []);

    const fetchStatus = useCallback(async () => {
        const { data, error } = await send(strategyUrl('/status', strategyId), {}, 'GET');
        if (error) {
            showToast(`상태 조회 실패: ${error}`);
            return;
        }
        setStatus(data.response);
        setCapitalInput((prev) => (prev === '' ? String(Math.round(data.response.capitalKrw)) : prev));
    }, [strategyId, showToast]);

    const fetchRuns = useCallback(async () => {
        const { data, error } = await send(strategyUrl('/runs', strategyId), { limit: RUN_LIMIT }, 'GET');
        if (!error) setRuns(data.response.runs || []);
    }, [strategyId]);

    const refresh = useCallback(() => {
        fetchStatus();
        fetchRuns();
    }, [fetchStatus, fetchRuns]);

    useEffect(() => {
        refresh();
        const timer = setInterval(fetchStatus, STATUS_REFRESH_MS);
        return () => clearInterval(timer);
    }, [refresh, fetchStatus]);

    /** 전략 API 호출 (전략 id 쿼리 자동 첨부, 호출 중 busy 표시) */
    const call = useCallback(async (path, body, method) => {
        setBusy(true);
        const result = await send(strategyUrl(path, strategyId), body, method);
        setBusy(false);
        return result;
    }, [strategyId]);

    const updateSettings = useCallback(async (body, successMsg) => {
        const { error } = await call('/settings', body, 'PUT');
        if (error) {
            showToast(`변경 실패: ${error}`);
            return;
        }
        showToast(successMsg);
        refresh();
    }, [call, showToast, refresh]);

    return { status, runs, toast, busy, capitalInput, setCapitalInput, showToast, refresh, call, updateSettings };
}
