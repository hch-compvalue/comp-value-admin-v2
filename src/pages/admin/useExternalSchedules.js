import { useState, useEffect, useCallback } from 'react';
import { send } from '@/util/ClientUtil';
import {
    DB_BACKUP_HISTORY_URL, DB_BACKUP_HISTORY_LIMIT, STRATEGY_LIST_URL, STRATEGY_RUNS_URL,
} from '@/config/scheduleExternal';

/**
 * 다른 곳에서 관리되는 스케줄 조회 — 자동매매 전략(trader), DB 백업(k8s CronJob)
 * - 타임라인과 조회 전용 목록이 같은 데이터를 씀
 * @returns {{strategies, lastRuns, backupHistory, errors, refresh}}
 */
export default function useExternalSchedules() {
    const [strategies, setStrategies] = useState([]);
    const [lastRuns, setLastRuns] = useState({});
    const [backupHistory, setBackupHistory] = useState([]);
    const [errors, setErrors] = useState([]);

    // 실패하면 화면에 보여줄 이름, 성공하면 null
    const fetchStrategies = useCallback(async () => {
        const { data, error } = await send(STRATEGY_LIST_URL, {}, 'GET');
        const list = data?.response?.strategies;
        if (error || !Array.isArray(list)) return '자동매매 전략';
        setStrategies(list);
        const runs = await Promise.all(list.map(async (s) => {
            const res = await send(`${STRATEGY_RUNS_URL}?strategy=${encodeURIComponent(s.id)}`, { limit: 1 }, 'GET');
            return [s.id, res.data?.response?.runs?.[0] || null];
        }));
        setLastRuns(Object.fromEntries(runs));
        return null;
    }, []);

    const fetchBackupHistory = useCallback(async () => {
        const { data, error } = await send(`${DB_BACKUP_HISTORY_URL}?limit=${DB_BACKUP_HISTORY_LIMIT}`, {}, 'GET');
        if (error || !Array.isArray(data?.response)) return 'DB 백업';
        setBackupHistory(data.response);
        return null;
    }, []);

    const refresh = useCallback(async () => {
        const failed = await Promise.all([fetchStrategies(), fetchBackupHistory()]);
        setErrors(failed.filter(Boolean));
    }, [fetchStrategies, fetchBackupHistory]);

    useEffect(() => { refresh(); }, [refresh]);

    return { strategies, lastRuns, backupHistory, errors, refresh };
}
