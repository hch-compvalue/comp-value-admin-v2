import { useState } from 'react';
import { CHART_INTERVALS, DEFAULT_INTERVAL } from '@/util/chartInterval';

export const CHART_STYLES = Object.freeze({ LINE: 'line', CANDLE: 'candle' });

const DEFAULT_PREF = { interval: DEFAULT_INTERVAL, style: CHART_STYLES.LINE };

function readSaved(storageKey) {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
        return {
            interval: CHART_INTERVALS.some((i) => i.key === saved.interval) ? saved.interval : DEFAULT_PREF.interval,
            style: Object.values(CHART_STYLES).includes(saved.style) ? saved.style : DEFAULT_PREF.style,
        };
    } catch {
        return DEFAULT_PREF; // 저장소 차단·손상 시 기본값
    }
}

/**
 * 차트 봉 단위 + 선/캔들 표시 방식 (차트별로 브라우저에 기억)
 * @param {string} storageKey - 차트마다 다른 키 (예: 'chart.stock', 'chart.index')
 */
export function useChartPreference(storageKey) {
    const [pref, setPref] = useState(() => readSaved(storageKey));

    const update = (patch) => {
        setPref((prev) => {
            const next = { ...prev, ...patch };
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
            } catch {
                // 저장 실패 시 현재 세션 동안만 유지
            }
            return next;
        });
    };

    return {
        interval: pref.interval,
        style: pref.style,
        setInterval: (interval) => update({ interval }),
        setStyle: (style) => update({ style }),
    };
}
