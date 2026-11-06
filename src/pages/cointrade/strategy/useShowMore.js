import { useState } from 'react';

/** 실행 기록 표에 처음 보여줄 건수 */
export const RUNS_INITIAL = 10;
/** [더 보기] 한 번에 더 펼치는 건수 */
export const RUNS_STEP = 20;

/**
 * 긴 목록을 앞에서부터 일부만 보여주기 — [더 보기]로 늘리고 [접기]로 처음 건수로
 * @returns {{visible, shown, total, hasMore, canCollapse, showMore, collapse}}
 */
export default function useShowMore(items, initial = RUNS_INITIAL, step = RUNS_STEP) {
    const [limit, setLimit] = useState(initial);
    const total = items.length;
    return {
        visible: items.slice(0, limit),
        shown: Math.min(limit, total),
        total,
        hasMore: total > limit,
        canCollapse: limit > initial && total > initial,
        showMore: () => setLimit((n) => n + step),
        collapse: () => setLimit(initial),
    };
}
