import { useState, useEffect, useCallback } from 'react';
import { send } from '@/util/ClientUtil';
import { API, STATUS_REFRESH_MS } from './strategyCommon';

/**
 * 전체(코인+주식) 실전 장부 합산 조회 (전체 탭 전용)
 * 탭이 활성일 때만 마운트되므로 폴링도 그때만 돈다. STATUS_REFRESH_MS마다 자동 갱신.
 */
export default function useOverviewData() {
    const [overview, setOverview] = useState(null);
    const [fetchError, setFetchError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);   // 주식 시세 조회로 수 초 걸릴 수 있음

    const refresh = useCallback(async () => {
        setRefreshing(true);
        const { data, error } = await send(`${API}/overview`, {}, 'GET');
        setRefreshing(false);
        if (error) {
            setFetchError(`전체 현황 조회 실패: ${error}`);
            return;
        }
        setFetchError(null);
        setOverview(data.response);
    }, []);

    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, STATUS_REFRESH_MS);
        return () => clearInterval(timer);
    }, [refresh]);

    return { overview, fetchError, refreshing, refresh };
}
