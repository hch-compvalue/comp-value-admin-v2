import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/component/common/button/Button';
import {
    WEEKDAYS, ALL_DAYS, BUSINESS_DAYS,
    parseSimpleCron, buildSimpleCron, describeCron, isNightHour,
} from '@/util/CronUtil';
import { SCHEDULE_AFFECTED_SCREENS } from '@/config/scheduleAffectedScreens';
import { jobMetaOf } from '@/config/scheduleJobMeta';
import StatusBadge from '@/pages/admin/ScheduleStatusBadge';
import { formatDateTime, formatDuration } from '@/pages/admin/scheduleFormat';

const TRIGGER_LABEL = { AUTO: '자동', MANUAL: '수동' };

const SCREEN_KIND_LABEL = { output: '결과 반영', input: '실행 기준' };

/**
 * 영향받는 화면 — 클릭 시 해당 메뉴(하위 탭)로 이동
 */
const AffectedScreens = ({ jobKey }) => {
    const navigate = useNavigate();
    const screens = SCHEDULE_AFFECTED_SCREENS[jobKey] || [];
    if (screens.length === 0) return null;

    return (
        <div className="mt-4">
            <h3 className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">영향받는 화면</h3>
            <ul className="flex flex-wrap gap-2">
                {screens.map((s) => (
                    <li key={s.label}>
                        <button
                            type="button"
                            title={s.note}
                            onClick={() => navigate(s.path, { state: { subTab: s.subTab } })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:bg-sky-900/30 dark:hover:text-sky-300"
                        >
                            <span className={`rounded px-1 py-px text-[10px] font-semibold ${s.kind === 'output'
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                {SCREEN_KIND_LABEL[s.kind]}
                            </span>
                            {s.label}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

/** 이름 앞 시장 꼬리표 (미국주식·국내주식) */
export const MarketChip = ({ jobKey }) => {
    const { market } = jobMetaOf(jobKey);
    if (!market) return null;
    return <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${market.className}`}>{market.label}</span>;
};

const toTimeText = (hour, minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/**
 * 실행 주기 편집 (요일 + 시각, 그 외 형식은 cron 직접 입력)
 */
const ScheduleEditor = ({ job, saving, onSave }) => {
    const parsed = useMemo(() => parseSimpleCron(job.cronExpression), [job.cronExpression]);
    const [advanced, setAdvanced] = useState(!parsed);
    const [days, setDays] = useState(parsed?.days ?? [...ALL_DAYS]);
    const [time, setTime] = useState(parsed ? toTimeText(parsed.hour, parsed.minute) : '10:00');
    const [rawCron, setRawCron] = useState(job.cronExpression);

    // 서버 값이 바뀌면(저장·새로고침) 입력값 동기화
    useEffect(() => {
        const p = parseSimpleCron(job.cronExpression);
        setRawCron(job.cronExpression);
        if (p) {
            setDays(p.days);
            setTime(toTimeText(p.hour, p.minute));
        }
    }, [job.cronExpression]);

    const [hour, minute] = time.split(':').map(Number);
    const nextCron = advanced ? rawCron.trim() : buildSimpleCron({ hour, minute, days });
    const isChanged = nextCron !== job.cronExpression;
    const canSave = isChanged && (advanced ? nextCron.length > 0 : days.length > 0 && time);
    const nightWarning = advanced ? isNightHour(parseSimpleCron(nextCron)?.hour ?? NaN) : isNightHour(hour);

    const toggleDay = (value) => setDays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));

    return (
        <div className="space-y-3">
            {advanced ? (
                <div>
                    <input
                        type="text"
                        value={rawCron}
                        onChange={(e) => setRawCron(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder="초 분 시 일 월 요일 (예: 0 0 10 * * *)"
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Spring cron 형식: 초 분 시 일 월 요일 (요일 0=일, 1=월 … 6=토)</p>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    {WEEKDAYS.map((d) => (
                        <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleDay(d.value)}
                            aria-pressed={days.includes(d.value)}
                            className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${days.includes(d.value)
                                ? 'bg-blue-600 text-white dark:bg-blue-500'
                                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                        >
                            {d.label}
                        </button>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => setDays([...ALL_DAYS])}>매일</Button>
                    <Button variant="ghost" size="sm" onClick={() => setDays([...BUSINESS_DAYS])}>평일</Button>
                    <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                </div>
            )}

            {nightWarning && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    밤(00~08시)에는 PC가 꺼져 있어 실행이 조용히 누락됩니다. 낮 시간으로 설정하세요.
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={!canSave || saving} onClick={() => onSave(job.jobKey, { cronExpression: nextCron })}>
                    {saving ? '저장 중…' : '주기 저장'}
                </Button>
                {isChanged && !advanced && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">변경 후: {describeCron(nextCron)}</span>
                )}
                <button
                    type="button"
                    onClick={() => setAdvanced((v) => !v)}
                    className="ml-auto text-xs text-sky-600 hover:underline dark:text-sky-400"
                >
                    {advanced ? '요일·시각으로 설정' : 'cron 직접 입력'}
                </button>
            </div>
        </div>
    );
};

/**
 * 스케줄 작업 카드 — 상태, 사용 여부, 실행 주기, 지금 실행, 최근 이력
 */
const ScheduleJobCard = ({ job, history, saving, onToggle, onSave, onRun }) => (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <MarketChip jobKey={job.jobKey} />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{job.label}</h2>
                    {job.running
                        ? <StatusBadge status="RUNNING" />
                        : <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${job.enabled
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                            {job.enabled ? '자동 실행 켜짐' : '자동 실행 꺼짐'}
                        </span>}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{job.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" size="sm" disabled={saving} onClick={() => onToggle(job)}>
                    {job.enabled ? '자동 실행 끄기' : '자동 실행 켜기'}
                </Button>
                <Button size="sm" disabled={job.running} onClick={() => onRun(job)}>
                    {job.running ? '실행 중' : '지금 실행'}
                </Button>
            </div>
        </div>

        {job.running && (
            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                실행 중입니다 ({formatDuration(job.lastRun?.startedAt)} 경과). 끝날 때까지 백엔드 배포를 미뤄주세요 — 재시작되면 작업이 중단됩니다.
            </p>
        )}

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">실행 주기</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-white">{describeCron(job.cronExpression)}</dd>
            </div>
            <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">다음 자동 실행</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-white">{job.enabled ? formatDateTime(job.nextRunAt) : '꺼짐'}</dd>
            </div>
            <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">마지막 실행</dt>
                <dd className="mt-0.5 flex items-center gap-2 text-slate-900 dark:text-white">
                    {job.lastRun
                        ? <>{formatDateTime(job.lastRun.startedAt)} <StatusBadge status={job.lastRun.status} /></>
                        : '이력 없음'}
                </dd>
            </div>
        </dl>

        <AffectedScreens jobKey={job.jobKey} />

        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">실행 주기 변경</h3>
            <ScheduleEditor job={job} saving={saving} onSave={onSave} />
        </div>

        <RunHistory history={history} />
    </section>
);

/**
 * 최근 실행 이력 — 기본 접힘 (마지막 실행은 카드 위쪽에 이미 표시)
 */
const RunHistory = ({ history }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}>
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                </svg>
                최근 실행 이력
                <span className="text-xs font-normal text-slate-400">{history.length}건</span>
            </button>
            {open && (
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                {['시작', '구분', '상태', '소요', '결과'].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">실행 이력이 없습니다.</td></tr>
                            )}
                            {history.map((h) => (
                                <tr key={h.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                                    <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{formatDateTime(h.startedAt)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                        {TRIGGER_LABEL[h.triggerType] || h.triggerType}
                                        {h.triggerType === 'MANUAL' && h.maxCount > 0 && <span className="ml-1 text-xs text-slate-400">({h.maxCount}건)</span>}
                                    </td>
                                    <td className="px-3 py-2"><StatusBadge status={h.status} /></td>
                                    <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">{formatDuration(h.startedAt, h.endedAt)}</td>
                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{h.message || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ScheduleJobCard;
