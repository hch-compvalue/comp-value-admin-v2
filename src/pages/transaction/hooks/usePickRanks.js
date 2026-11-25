import { useEffect, useState } from 'react';
import { fetchValueRanks } from '@/util/PickRank';

/**
 * 보유 종목 매수일 칸에 보여줄 종목 발굴 현재 순위 (시장별)
 * @returns {{ranks: Map<string, number>, baseDate: string}|null} 불러오는 중·실패면 null (순위 줄 숨김)
 */
export function usePickRanks(market) {
    const [rankInfo, setRankInfo] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setRankInfo(null);
        fetchValueRanks(market).then((info) => {
            if (!cancelled) setRankInfo(info);
        });
        return () => { cancelled = true; };   // 시장 전환 시 늦게 온 이전 시장 응답 무시
    }, [market]);

    return rankInfo;
}
