import { useTheme } from '@/context/ThemeContext';
import TruncatedText from './TruncatedText';
import { SLATE } from '@/config/themeColors';

/**
 * 파드별 리소스 게이지 — CPU / Memory 프로그레스 바
 * 색상: 정상(emerald) → 경고(amber, >70%) → 위험(rose, >90%)
 */
export default function ResourceGauges({ resources }) {
    const containers = resources?.containers || [];
    const gpu = resources?.gpu;

    if (!containers.length && !gpu) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400 dark:text-slate-600 text-sm">
                {resources ? 'Prometheus not connected' : 'No resource data'}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {containers.map((pod, i) => (
                <PodResourceRow key={pod.name || i} pod={pod} />
            ))}
            {gpu && <GpuRow gpu={gpu} />}
        </div>
    );
}

function PodResourceRow({ pod }) {
    const rawCpuPercent = Math.max(pod.cpuPercent || 0, 0);
    const hasCpuLimit = pod.cpuLimitCores > 0;
    const cpuCores = rawCpuPercent / 100;
    const cpuPercent = hasCpuLimit
        ? Math.min((cpuCores / pod.cpuLimitCores) * 100, 100)
        : Math.min(rawCpuPercent, 100);
    const cpuText = hasCpuLimit
        ? `${cpuCores.toFixed(1)}/${pod.cpuLimitCores.toFixed(1)} cores`
        : `${rawCpuPercent.toFixed(1)}%`;

    const hasMemLimit = pod.memoryLimitMB > 0;
    const memPercent = hasMemLimit
        ? Math.min((pod.memoryMB / pod.memoryLimitMB) * 100, 100)
        : 0;
    const memText = hasMemLimit
        ? `${pod.memoryMB}/${pod.memoryLimitMB} MB`
        : `${pod.memoryMB} MB`;

    return (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-2.5 space-y-1.5 overflow-hidden">
            <TruncatedText as="div" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {pod.name}
            </TruncatedText>
            <ProgressBar
                label="CPU"
                percent={cpuPercent}
                text={cpuText}
                noLimit={!hasCpuLimit}
            />
            <ProgressBar
                label="MEM"
                percent={memPercent}
                text={memText}
                noLimit={!hasMemLimit}
            />
        </div>
    );
}

function GpuRow({ gpu }) {
    const utilPercent = Math.min(Math.max(gpu.utilPercent || 0, 0), 100);
    const memPercent = gpu.memTotalMB > 0
        ? Math.min((gpu.memUsedMB / gpu.memTotalMB) * 100, 100)
        : 0;

    return (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-2.5 space-y-1.5 overflow-hidden">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">GPU</div>
            <ProgressBar
                label="UTIL"
                percent={utilPercent}
                text={`${utilPercent.toFixed(1)}%`}
            />
            <ProgressBar
                label="VRAM"
                percent={memPercent}
                text={`${gpu.memUsedMB}/${gpu.memTotalMB} MB`}
            />
        </div>
    );
}

function ProgressBar({ label, percent, text, noLimit }) {
    const { isDark } = useTheme();
    const color = noLimit ? (isDark ? SLATE[600] : SLATE[400]) : getColor(percent);
    const trackColor = isDark ? SLATE[800] : SLATE[200];

    return (
        <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 w-7 shrink-0">{label}</span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden min-w-4" style={{ backgroundColor: trackColor }}>
                {noLimit ? (
                    <div className="h-full w-full opacity-30" style={{ backgroundColor: color }} />
                ) : (
                    <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${percent}%`, backgroundColor: color }}
                    />
                )}
            </div>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 text-right truncate shrink-0 sm:max-w-[6.5rem]">{text}</span>
        </div>
    );
}

function getColor(percent) {
    if (percent >= 90) return '#ef4444';
    if (percent >= 70) return '#f59e0b';
    return '#22c55e';
}
