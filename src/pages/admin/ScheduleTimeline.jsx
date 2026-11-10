import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { NIGHT_END_HOUR, describeDays } from '@/util/CronUtil';
import {
    SAFE_GAP_MINUTES, buildOrderWarnings, timelineRange, nowMinute, minuteText, formatMinutes,
} from '@/pages/admin/scheduleTimelineModel';

const MINUTES_PER_HOUR = 60;
// 시각 눈금 글자 간격 (시간)
const LABEL_EVERY_HOURS = 2;
// "지금" 선 갱신 주기
const CLOCK_TICK_MS = 60 * 1000;
// 소요 시간이 짧거나 모르는 작업도 보이도록 하는 최소 막대 폭 (분)
const MIN_BAR_MINUTES = 6;

const BAR_STYLE = {
    US: 'bg-blue-500 dark:bg-blue-400',
    KR: 'bg-amber-400 dark:bg-amber-400',
    external: 'border border-dashed border-slate-400 bg-slate-200 dark:border-slate-500 dark:bg-slate-600',
};

const barStyleOf = (row) => (row.external ? BAR_STYLE.external : BAR_STYLE[row.market?.key] ?? BAR_STYLE.external);

function useNowMinute() {
    const [now, setNow] = useState(() => nowMinute());
    useEffect(() => {
        const timer = setInterval(() => setNow(nowMinute()), CLOCK_TICK_MS);
        return () => clearInterval(timer);
    }, []);
    return now;
}

/** 막대 마우스오버 문구 */
const barTitle = (row) => [
    row.label,
    `${describeDays(row.days)} ${minuteText(row.start)} 시작`,
    row.duration != null ? `평소 ${formatMinutes(row.duration)} (최근 성공 실행 중앙값)` : '소요 시간 기록 없음',
    !row.enabled && '자동 실행 꺼짐',
    row.running && '지금 실행 중',
].filter(Boolean).join(' · ');

/**
 * 하루 타임라인 — 작업별 시작 시각·평소 소요 시간 막대, 밤 시간(PC 꺼짐) 음영, 지금 시각 선, 순서 경고
 */
export default function ScheduleTimeline({ rows }) {
    const now = useNowMinute();
    const { from, to } = useMemo(() => timelineRange(rows), [rows]);
    const warnings = useMemo(() => buildOrderWarnings(rows), [rows]);
    const warnedKeys = new Set(warnings.map((w) => w.key));
    const span = to - from;
    const pct = (min) => `${((Math.min(Math.max(min, from), to) - from) / span) * 100}%`;
    const hours = Array.from({ length: span / MINUTES_PER_HOUR + 1 }, (_, i) => from / MINUTES_PER_HOUR + i);
    const nightEnd = NIGHT_END_HOUR * MINUTES_PER_HOUR;
    const showNow = now >= from && now <= to;
    const placed = rows.filter((r) => r.start != null);
    const unplaced = rows.filter((r) => r.start == null);

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">하루 일정</h2>
                <Legend />
            </div>
            <p className="mt-1 hidden text-xs text-slate-500 md:block dark:text-slate-400">막대 길이는 최근 성공 실행의 평소 소요 시간입니다. 막대에 마우스를 올리면 자세히 보입니다.</p>

            {/* 모바일: 막대 차트는 가로 스크롤·마우스오버가 필요해서 시각 순 목록으로 대신 보여줌 */}
            <TimelineList rows={placed} warnedKeys={warnedKeys} now={now} />

            <div className="mt-4 hidden overflow-x-auto md:block">
                <div className="min-w-[640px]">
                    {/* 시각 눈금 */}
                    <div className="flex">
                        <div className="w-48 shrink-0" />
                        <div className="relative h-5 flex-1">
                            {hours.map((h) => (h % LABEL_EVERY_HOURS === 0 || h === hours[hours.length - 1]) && (
                                <span key={h} className="absolute -translate-x-1/2 text-xs text-slate-400" style={{ left: pct(h * MINUTES_PER_HOUR) }}>
                                    {String(h).padStart(2, '0')}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-48 right-0">
                            {/* 밤 시간 (PC 꺼짐) */}
                            {from < nightEnd && (
                                <div className="absolute inset-y-0 bg-slate-100 dark:bg-slate-900/60" style={{ left: 0, width: pct(nightEnd) }} title="PC 꺼짐 — 실행 누락" />
                            )}
                            {hours.map((h) => (
                                <div key={h} className="absolute inset-y-0 border-l border-slate-100 dark:border-slate-700/60" style={{ left: pct(h * MINUTES_PER_HOUR) }} />
                            ))}
                            {showNow && (
                                <div className="absolute inset-y-0 border-l-2 border-blue-600 dark:border-blue-400" style={{ left: pct(now) }}>
                                    <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-blue-600 px-1 text-[10px] font-semibold text-white dark:bg-blue-500">
                                        지금 {minuteText(now)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <ul className="relative">
                            {placed.map((row) => (
                                <TimelineRow key={row.key} row={row} warned={warnedKeys.has(row.key)} pct={pct} />
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {unplaced.length > 0 && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    시각을 표시할 수 없는 작업(cron 직접 입력): {unplaced.map((r) => r.label).join(', ')}
                </p>
            )}

            {warnings.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                    {warnings.map((w) => (
                        <li key={`${w.before.key}-${w.after.key}`} className="flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                <strong>{w.after.label}</strong> 시작({minuteText(w.after.start)})이 앞 작업 <strong>{w.before.label}</strong>의 평소 종료 시각(
                                {minuteText(w.before.start + w.before.duration)})
                                {w.gap < 0 ? `보다 ${-w.gap}분 빠릅니다.` : `과 ${w.gap}분밖에 차이 나지 않습니다.`}
                                {' '}앞 작업이 조금만 늦어도 이전 데이터로 실행됩니다 — {SAFE_GAP_MINUTES}분 이상 띄우는 것을 권장합니다.
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/** 모바일용 시각 순 목록 — 시작~평소 종료, 지금 시각 구분선 */
function TimelineList({ rows, warnedKeys, now }) {
    const sorted = [...rows].sort((a, b) => a.start - b.start);
    const nowIndex = sorted.findIndex((r) => r.start > now);
    const nowAt = nowIndex === -1 ? sorted.length : nowIndex;
    const items = sorted.map((row) => <TimelineListItem key={row.key} row={row} warned={warnedKeys.has(row.key)} />);
    items.splice(nowAt, 0, (
        <li key="now" className="flex items-center gap-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            <span className="h-px flex-1 bg-blue-600 dark:bg-blue-400" />지금 {minuteText(now)}<span className="h-px flex-1 bg-blue-600 dark:bg-blue-400" />
        </li>
    ));
    return <ul className="mt-3 divide-y divide-slate-100 md:hidden dark:divide-slate-700">{items}</ul>;
}

function TimelineListItem({ row, warned }) {
    const endText = row.duration != null ? ` ~ ${minuteText(row.start + row.duration)}` : '';
    return (
        <li className={`flex items-start gap-3 py-2.5 ${row.enabled ? '' : 'opacity-50'}`}>
            <span aria-hidden="true" className={`mt-1.5 inline-block h-2.5 w-4 shrink-0 rounded-sm ${barStyleOf(row)} ${row.running ? 'animate-pulse' : ''}`} />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{row.label}</span>
                    <span className="shrink-0 text-sm tabular-nums text-slate-700 dark:text-slate-300">{minuteText(row.start)}{endText}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{describeDays(row.days)}</span>
                    <span>{row.duration != null ? `평소 ${formatMinutes(row.duration)}` : '소요 시간 기록 없음'}</span>
                    {!row.enabled && <span>꺼짐</span>}
                    {row.running && <span className="font-semibold text-blue-600 dark:text-blue-400">실행 중</span>}
                    {warned && (
                        <span className="inline-flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-300">
                            <AlertTriangle aria-hidden="true" className="h-3 w-3" />순서 주의
                        </span>
                    )}
                </div>
            </div>
        </li>
    );
}

function TimelineRow({ row, warned, pct }) {
    const end = row.start + Math.max(row.duration ?? 0, MIN_BAR_MINUTES);
    return (
        <li className={`flex h-10 items-center ${row.enabled ? '' : 'opacity-50'}`}>
            <div className="w-48 shrink-0 pr-3">
                <div className="truncate text-sm text-slate-800 dark:text-slate-200" title={row.label}>
                    {row.label}
                </div>
                <div className="truncate text-xs text-slate-400">
                    {describeDays(row.days)} {minuteText(row.start)}
                    {row.duration != null && ` · ${formatMinutes(row.duration)}`}
                    {!row.enabled && ' · 꺼짐'}
                </div>
            </div>
            <div className="relative h-full flex-1">
                <div
                    title={barTitle(row)}
                    className={`absolute top-1/2 h-4 -translate-y-1/2 rounded ${barStyleOf(row)} ${row.running ? 'animate-pulse' : ''} ${warned ? 'ring-2 ring-orange-500 ring-offset-1 dark:ring-offset-slate-800' : ''}`}
                    style={{ left: pct(row.start), width: `calc(${pct(end)} - ${pct(row.start)})` }}
                />
            </div>
        </li>
    );
}

function Legend() {
    const items = [
        { label: '미국주식', className: BAR_STYLE.US },
        { label: '국내주식', className: BAR_STYLE.KR },
        { label: '다른 곳에서 관리', className: BAR_STYLE.external },
    ];
    return (
        <ul className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {items.map((it) => (
                <li key={it.label} className="flex items-center gap-1.5">
                    <span className={`inline-block h-2.5 w-4 rounded-sm ${it.className}`} />
                    {it.label}
                </li>
            ))}
            <li className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-900/60 dark:ring-slate-700" />
                밤(PC 꺼짐)
            </li>
        </ul>
    );
}
