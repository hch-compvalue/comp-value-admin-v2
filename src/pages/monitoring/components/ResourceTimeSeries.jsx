import { useMemo, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { useTheme } from '@/context/ThemeContext';
import { SLATE, CHART_GRID } from '@/config/themeColors';
import { POD_LABEL, WARN_PCT } from '../monitoringModel';
import { Panel, Segmented } from './MonitoringUi';

// 파드별 선 색 (적록색약 — 빨강·초록 없음)
const POD_COLORS = ['#3b82f6', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];
// GPU 선 — 파드 색과 겹치지 않는 중립색
const GPU_COLOR = SLATE[500];
const GPU_KEY = 'gpu';
const CHART_HEIGHT = 240;
const WINDOW_MS = 30 * 60 * 1000;
const PERCENT = 100;
const MIN_POINTS = 2;

const METRICS = [
    { value: 'cpu', label: 'CPU' },
    { value: 'mem', label: '메모리' },
];

const formatTime = (ts) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 파드 1개의 한도 대비 CPU·메모리 % */
function podPercent(c) {
    const rawCpu = c.cpuPercent || 0;
    const cpu = c.cpuLimitCores > 0 ? rawCpu / c.cpuLimitCores : rawCpu;
    const mem = c.memoryLimitMB > 0 ? (c.memoryMB / c.memoryLimitMB) * PERCENT : 0;
    return { cpu: Number(cpu.toFixed(1)), mem: Number(mem.toFixed(1)) };
}

/**
 * 리소스 추이 (최근 30분) — CPU/메모리 전환, 범례 클릭으로 선 숨김, 70% 주의선
 */
export default function ResourceTimeSeries({ resourceHistory = [] }) {
    const { isDark } = useTheme();
    const [metric, setMetric] = useState('cpu');
    const [hiddenKeys, setHiddenKeys] = useState(new Set());

    // 파드 이름 목록 (출현 순서 유지)
    const podNames = useMemo(() => {
        const names = [];
        resourceHistory.forEach((entry) => (entry.containers || []).forEach((c) => {
            if (c.name && !names.includes(c.name)) names.push(c.name);
        }));
        return names;
    }, [resourceHistory]);

    const hasGpu = useMemo(() => resourceHistory.some((e) => e.gpu?.utilPercent != null), [resourceHistory]);

    const chartData = useMemo(() => resourceHistory.map((entry) => {
        const point = { time: entry.ts };
        (entry.containers || []).forEach((c) => {
            const p = podPercent(c);
            point[`${c.name}_cpu`] = p.cpu;
            point[`${c.name}_mem`] = p.mem;
        });
        if (entry.gpu) {
            point[`${GPU_KEY}_cpu`] = Number((entry.gpu.utilPercent || 0).toFixed(1));
            point[`${GPU_KEY}_mem`] = entry.gpu.memTotalMB > 0
                ? Number(((entry.gpu.memUsedMB / entry.gpu.memTotalMB) * PERCENT).toFixed(1))
                : 0;
        }
        return point;
    }), [resourceHistory]);

    // 현재 지표의 선 목록
    const series = useMemo(() => {
        const list = podNames.map((name, i) => ({ id: name, label: POD_LABEL[name] ?? name, color: POD_COLORS[i % POD_COLORS.length] }));
        if (hasGpu) list.push({ id: GPU_KEY, label: 'GPU', color: GPU_COLOR });
        return list.map((s) => ({ ...s, dataKey: `${s.id}_${metric}` }));
    }, [podNames, hasGpu, metric]);

    const toggleSeries = useCallback((id) => {
        setHiddenKeys((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const metricLabel = metric === 'cpu' ? 'CPU' : '메모리';
    const tickColor = SLATE[isDark ? 400 : 500];
    const axisColor = SLATE[isDark ? 600 : 300];

    // 데이터가 30분 미만이면 데이터 범위, 이상이면 최근 30분
    const now = chartData.length ? chartData[chartData.length - 1].time : Date.now();
    const first = chartData.length ? chartData[0].time : now;
    const domainMin = now - first >= WINDOW_MS ? now - WINDOW_MS : first;

    return (
        <Panel
            title="리소스 추이"
            subtitle="최근 30분 · 한도 대비 %"
            actions={<Segmented label="지표 선택" options={METRICS} value={metric} onChange={setMetric} />}
        >
            {chartData.length < MIN_POINTS ? (
                <div className="flex items-center justify-center text-sm text-slate-400 dark:text-slate-500" style={{ height: CHART_HEIGHT }}>
                    데이터를 모으는 중입니다.
                </div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                            <XAxis dataKey="time" type="number" domain={[domainMin, now]} tickFormatter={formatTime}
                                tick={{ fontSize: 11, fill: tickColor }} stroke={axisColor} interval="preserveStartEnd" />
                            <YAxis domain={[0, PERCENT]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: tickColor }} stroke={axisColor} />
                            <ReferenceLine y={WARN_PCT} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.6} />
                            <Tooltip
                                wrapperStyle={{ zIndex: 50 }}
                                contentStyle={{
                                    backgroundColor: isDark ? SLATE[800] : '#ffffff',
                                    border: `1px solid ${SLATE[isDark ? 600 : 200]}`,
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: SLATE[isDark ? 100 : 800],
                                }}
                                labelFormatter={formatTime}
                                formatter={(value, name) => [`${value}%`, `${name} ${metricLabel}`]}
                            />
                            {series.map((s) => (
                                <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.label} stroke={s.color}
                                    strokeWidth={2} dot={false} connectNulls isAnimationActive={false} hide={hiddenKeys.has(s.id)} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                        {series.map((s) => {
                            const hidden = hiddenKeys.has(s.id);
                            return (
                                <button key={s.id} type="button" aria-pressed={!hidden} onClick={() => toggleSeries(s.id)}
                                    className={`inline-flex items-center gap-1.5 ${hidden ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                    <span aria-hidden="true" className="h-0.5 w-3 rounded" style={{ backgroundColor: hidden ? SLATE[400] : s.color }} />
                                    {s.label}
                                </button>
                            );
                        })}
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                            <span aria-hidden="true" className="w-3 border-t border-dashed border-amber-500" />
                            주의 기준 {WARN_PCT}%
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">항목을 누르면 숨김</span>
                    </div>
                </>
            )}
        </Panel>
    );
}
