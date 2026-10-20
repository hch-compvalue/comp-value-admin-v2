import { useMemo, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useTheme } from '@/context/ThemeContext';
import { SLATE } from '@/config/themeColors';

const POD_COLORS = ['#3b82f6', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];
// GPU 선 — 파드 색과 겹치지 않는 중립색 (초록은 분홍 파드 선과 적록색약에서 구분 안 됨)
const GPU_COLOR = SLATE[500];

function CustomLegend({ payload = [], hiddenKeys, onToggle }) {
    const groups = useMemo(() => {
        const map = new Map();
        const result = [];
        for (const entry of payload) {
            const dk = entry.dataKey;
            let pod, lineType, label;
            if (dk === 'gpu') {
                pod = 'GPU'; lineType = 'solid'; label = 'UTIL';
            } else if (dk === 'gpu_vram') {
                pod = 'GPU'; lineType = 'dashed'; label = 'VRAM';
            } else if (dk.endsWith('_cpu')) {
                pod = dk.slice(0, -4); lineType = 'solid'; label = 'CPU';
            } else if (dk.endsWith('_mem')) {
                pod = dk.slice(0, -4); lineType = 'dashed'; label = 'MEM';
            } else continue;
            if (!map.has(pod)) {
                const g = { pod, items: [] };
                map.set(pod, g);
                result.push(g);
            }
            map.get(pod).items.push({ dataKey: dk, color: entry.color, lineType, label });
        }
        return result;
    }, [payload]);

    if (!groups.length) return null;

    return (
        <div className="flex flex-row flex-wrap justify-center gap-x-2 gap-y-0.5 sm:flex-col sm:items-end sm:justify-start text-[10px] select-none">
            {groups.map(g => (
                <div key={g.pod} className="inline-flex items-center">
                    <span className="text-slate-500 dark:text-slate-400 text-right font-mono max-w-[7rem] shrink-0 pr-1.5 truncate" title={g.pod}>
                        {g.pod}
                    </span>
                    {g.items.map(item => {
                        const hidden = hiddenKeys.has(item.dataKey);
                        const c = hidden ? SLATE[400] : item.color;
                        return (
                            <button
                                key={item.dataKey}
                                className="inline-flex items-center gap-0.5 px-1 cursor-pointer"
                                onClick={() => onToggle({ dataKey: item.dataKey })}
                            >
                                <svg width="14" height="8" className="shrink-0">
                                    <line
                                        x1="0" y1="4" x2="14" y2="4"
                                        stroke={c}
                                        strokeWidth={item.lineType === 'solid' ? 2 : 1.5}
                                        strokeDasharray={item.lineType === 'dashed' ? '3 2' : undefined}
                                    />
                                </svg>
                                <span style={{
                                    color: c,
                                    textDecoration: hidden ? 'line-through' : 'none',
                                }}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

/**
 * Recharts LineChart — 파드별 CPU% + Memory% 시계열 (최근 30분)
 * CPU: 실선, Memory: 점선
 * 범례 클릭 토글 + 필터 버튼 (All / CPU / Memory)
 */
export default function ResourceTimeSeries({ resourceHistory = [] }) {
    const { isDark } = useTheme();
    const [hiddenKeys, setHiddenKeys] = useState(new Set());
    const [filter, setFilter] = useState('all'); // 'all' | 'cpu' | 'mem'

    // 파드 이름 목록 추출 (출현 순서 유지)
    const podNames = useMemo(() => {
        const seen = new Set();
        const names = [];
        resourceHistory.forEach(entry => {
            (entry.containers || []).forEach(c => {
                if (c.name && !seen.has(c.name)) {
                    seen.add(c.name);
                    names.push(c.name);
                }
            });
        });
        return names;
    }, [resourceHistory]);

    const chartData = useMemo(() => {
        return resourceHistory.map(entry => {
            const point = { time: entry.ts };
            for (const c of entry.containers || []) {
                const rawCpu = c.cpuPercent || 0;
                const cpuPct = c.cpuLimitCores > 0
                    ? (rawCpu / (c.cpuLimitCores * 100)) * 100
                    : rawCpu;
                point[`${c.name}_cpu`] = Number(cpuPct.toFixed(1));
                const memPct = c.memoryLimitMB > 0
                    ? (c.memoryMB / c.memoryLimitMB) * 100
                    : 0;
                point[`${c.name}_mem`] = Number(memPct.toFixed(1));
            }
            if (entry.gpu) {
                point.gpu = Number((entry.gpu.utilPercent || 0).toFixed(1));
                const vramPct = entry.gpu.memTotalMB > 0
                    ? (entry.gpu.memUsedMB / entry.gpu.memTotalMB) * 100
                    : 0;
                point.gpu_vram = Number(vramPct.toFixed(1));
            }
            return point;
        });
    }, [resourceHistory]);

    const hasGpu = useMemo(() =>
        resourceHistory.some(e => e.gpu?.utilPercent != null),
        [resourceHistory]
    );

    const handleLegendClick = useCallback((entry) => {
        const key = entry.dataKey;
        setHiddenKeys(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);

    // 현재 필터에 해당하는 dataKey 목록
    const getFilteredKeys = useCallback(() => {
        const keys = [];
        const isCpu = filter === 'all' || filter === 'cpu';
        const isMem = filter === 'all' || filter === 'mem';
        if (isCpu) podNames.forEach(n => keys.push(`${n}_cpu`));
        if (isMem) podNames.forEach(n => keys.push(`${n}_mem`));
        if (hasGpu && isCpu) keys.push('gpu');
        if (hasGpu && isMem) keys.push('gpu_vram');
        return keys;
    }, [filter, podNames, hasGpu]);

    const handleShowAll = useCallback(() => {
        const keys = getFilteredKeys();
        setHiddenKeys(prev => {
            const next = new Set(prev);
            keys.forEach(k => next.delete(k));
            return next;
        });
    }, [getFilteredKeys]);

    const handleHideAll = useCallback(() => {
        const keys = getFilteredKeys();
        setHiddenKeys(prev => {
            const next = new Set(prev);
            keys.forEach(k => next.add(k));
            return next;
        });
    }, [getFilteredKeys]);

    const showCpu = filter === 'all' || filter === 'cpu';
    const showMem = filter === 'all' || filter === 'mem';

    // 범례에 전달할 payload 생성 (Recharts Legend 밖으로 빼기 위해)
    const legendPayload = useMemo(() => {
        const items = [];
        if (showCpu) podNames.forEach((name, i) => items.push({
            dataKey: `${name}_cpu`, color: POD_COLORS[i % POD_COLORS.length],
        }));
        if (showMem) podNames.forEach((name, i) => items.push({
            dataKey: `${name}_mem`, color: POD_COLORS[i % POD_COLORS.length],
        }));
        if (hasGpu && showCpu) items.push({ dataKey: 'gpu', color: GPU_COLOR });
        if (hasGpu && showMem) items.push({ dataKey: 'gpu_vram', color: GPU_COLOR });
        return items;
    }, [showCpu, showMem, podNames, hasGpu]);

    if (chartData.length < 2) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400 dark:text-slate-600 text-sm">
                Collecting data...
            </div>
        );
    }

    const formatTime = (ts) => {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const gridColor = isDark ? SLATE[800] : SLATE[200];
    const axisColor = isDark ? SLATE[700] : SLATE[300];
    const tickColor = isDark ? SLATE[600] : SLATE[400];
    const tooltipBg = isDark ? SLATE[900] : '#ffffff';
    const tooltipBorder = isDark ? SLATE[700] : SLATE[200];
    const tooltipText = isDark ? SLATE[200] : SLATE[800];

    // 동적 윈도우: 데이터가 30분 미만이면 데이터 범위로, 30분 이상이면 고정 30분 윈도우
    const THIRTY_MIN = 30 * 60 * 1000;
    const now = chartData.length > 0 ? chartData[chartData.length - 1].time : Date.now();
    const firstTime = chartData.length > 0 ? chartData[0].time : now;
    const dataSpan = now - firstTime;
    const domainMin = dataSpan >= THIRTY_MIN ? now - THIRTY_MIN : firstTime;

    return (
        <div>
            <div className="flex flex-col sm:flex-row gap-1">
                {/* 차트 영역 */}
                <div className="flex-1 min-w-0 h-[220px]">
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis
                                dataKey="time"
                                type="number"
                                domain={[domainMin, now]}
                                tick={{ fontSize: 10, fill: tickColor }}
                                tickFormatter={formatTime}
                                interval="preserveStartEnd"
                                stroke={axisColor}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: tickColor }}
                                domain={[0, 100]}
                                tickFormatter={v => `${v}%`}
                                stroke={axisColor}
                            />
                            <Tooltip
                                wrapperStyle={{ zIndex: 50 }}
                                contentStyle={{
                                    backgroundColor: tooltipBg,
                                    border: `1px solid ${tooltipBorder}`,
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: tooltipText,
                                }}
                                labelFormatter={formatTime}
                                formatter={(value, name) => [`${value}%`, name]}
                            />
                            {/* CPU lines — 실선 */}
                            {showCpu && podNames.map((name, i) => (
                                <Line
                                    key={`${name}_cpu`}
                                    type="monotone"
                                    dataKey={`${name}_cpu`}
                                    name={`${name} CPU`}
                                    stroke={POD_COLORS[i % POD_COLORS.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                    hide={hiddenKeys.has(`${name}_cpu`)}
                                />
                            ))}
                            {/* Memory lines — 점선 */}
                            {showMem && podNames.map((name, i) => (
                                <Line
                                    key={`${name}_mem`}
                                    type="monotone"
                                    dataKey={`${name}_mem`}
                                    name={`${name} MEM`}
                                    stroke={POD_COLORS[i % POD_COLORS.length]}
                                    strokeWidth={1.5}
                                    strokeDasharray="4 3"
                                    dot={false}
                                    connectNulls
                                    hide={hiddenKeys.has(`${name}_mem`)}
                                />
                            ))}
                            {/* GPU util line (CPU 필터) */}
                            {hasGpu && showCpu && (
                                <Line
                                    type="monotone"
                                    dataKey="gpu"
                                    name="GPU"
                                    stroke={GPU_COLOR}
                                    strokeWidth={2}
                                    strokeDasharray="8 4"
                                    dot={false}
                                    connectNulls
                                    hide={hiddenKeys.has('gpu')}
                                />
                            )}
                            {/* GPU VRAM line (Memory 필터) */}
                            {hasGpu && showMem && (
                                <Line
                                    type="monotone"
                                    dataKey="gpu_vram"
                                    name="GPU VRAM"
                                    stroke={GPU_COLOR}
                                    strokeWidth={1.5}
                                    strokeDasharray="4 3"
                                    dot={false}
                                    connectNulls
                                    hide={hiddenKeys.has('gpu_vram')}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                {/* 범례 — 데스크탑: 차트 오른쪽 / 모바일: 차트 아래 */}
                <div className="shrink-0 flex flex-col justify-center overflow-y-auto sm:max-h-[220px]">
                    <CustomLegend payload={legendPayload} hiddenKeys={hiddenKeys} onToggle={handleLegendClick} />
                </div>
            </div>
            {/* 필터 버튼 */}
            <div className="flex justify-center items-center gap-1.5 mt-1.5">
                <FilterButton label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
                <FilterButton label="CPU" active={filter === 'cpu'} onClick={() => setFilter('cpu')} />
                <FilterButton label="Memory" active={filter === 'mem'} onClick={() => setFilter('mem')} />
                <span className="mx-1 text-slate-300 dark:text-slate-600">|</span>
                <FilterButton label="전체 ON" active={false} onClick={handleShowAll} />
                <FilterButton label="전체 OFF" active={false} onClick={handleHideAll} />
            </div>
        </div>
    );
}

function FilterButton({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-2.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                active
                    ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
        >
            {label}
        </button>
    );
}
