import { useMarket } from '@/context/MarketContext';
import { MARKET } from '@/util/MarketUtil';

/**
 * 미국 전용 화면 — 국내 선택 시 안내만 보이고, 미국 화면은 숨긴 채 유지한다
 * (토글을 오가도 진행 중이던 일괄 평가 등 미국 화면 상태가 사라지지 않게)
 * @param {string} krMessage 국내 선택 시 안내 문구
 */
export default function UsOnlyPanel({ krMessage, children }) {
    const { market } = useMarket();
    const isKr = market === MARKET.KR;
    return (
        <>
            {isKr && (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {krMessage}
                </div>
            )}
            <div hidden={isKr}>{children}</div>
        </>
    );
}
