import { useMarket } from '@/context/MarketContext';
import { MARKET } from '@/util/MarketUtil';

/**
 * 시장별로 다른 화면 — 미국/국내 화면 구성이 크게 다를 때 (예: 매도기록 환율 열)
 */
export default function MarketSwitch({ us, kr }) {
    const { market } = useMarket();
    return market === MARKET.KR ? kr : us;
}
