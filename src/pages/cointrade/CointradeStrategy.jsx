import { useState } from 'react';
import PageTitle from '@/component/common/display/PageTitle';
import CoinStrategyPanel from './strategy/CoinStrategyPanel';
import StockStrategyPanel from './strategy/StockStrategyPanel';

/**
 * 자동매매 대시보드 — 전략별 탭 (코인: btc_trend / 주식: etf3_trend_v1)
 * 탭마다 상태·실행 기록·설정을 ?strategy=<id>로 따로 조회/변경한다.
 * 선택 탭은 URL ?tab= 또는 localStorage로 기억한다.
 */

const TABS = [
    { key: 'coin', label: '코인', Panel: CoinStrategyPanel },
    { key: 'stock', label: '주식', Panel: StockStrategyPanel },
];
const TAB_STORAGE_KEY = 'autoTrade:tab';
const TAB_QUERY_KEY = 'tab';

const isValidTab = (key) => TABS.some((t) => t.key === key);

const loadInitialTab = () => {
    const fromQuery = new URLSearchParams(window.location.search).get(TAB_QUERY_KEY);
    if (isValidTab(fromQuery)) return fromQuery;
    try {
        const saved = localStorage.getItem(TAB_STORAGE_KEY);
        if (isValidTab(saved)) return saved;
    } catch { /* 저장소 접근 불가 시 기본 탭 */ }
    return TABS[0].key;
};

const saveTab = (key) => {
    try {
        localStorage.setItem(TAB_STORAGE_KEY, key);
    } catch { /* 저장 실패 무시 */ }
};

export default function CointradeStrategy() {
    const [activeKey, setActiveKey] = useState(loadInitialTab);

    const selectTab = (key) => {
        setActiveKey(key);
        saveTab(key);
    };

    const tabBar = (
        <div role="tablist" className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-slate-200 dark:border-slate-700">
            {TABS.map((tab) => {
                const isActive = tab.key === activeKey;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => selectTab(tab.key)}
                        className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            isActive
                                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-500'
                        }`}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );

    const { Panel } = TABS.find((t) => t.key === activeKey);

    return (
        <div className="p-2 md:p-4 space-y-4">
            <PageTitle />
            {/* 활성 탭만 마운트 — 비활성 탭의 60초 상태 폴링을 막는다 */}
            <Panel key={activeKey} header={tabBar} />
        </div>
    );
}
