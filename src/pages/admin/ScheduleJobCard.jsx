import { useState, useEffect, useMemo } from 'react';
import Button from '@/component/common/button/Button';
import {
    WEEKDAYS, ALL_DAYS, BUSINESS_DAYS,
    parseSimpleCron, buildSimpleCron, describeCron, isNightHour,
} from '@/util/CronUtil';

// 실행 상태 표시 (적록색약 고려: 성공=하늘, 실패=주황, 실행중=파랑, 중단=노랑)
const STATUS_STYLE = {
    RUNNING: { label: '실행 중', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    SUCCESS: { label: '성공', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
    FAILED: { label: '실패', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    INTERRUPTED: { label: '중단됨', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};
const TRIGGER_LABEL = { AUTO: '자동', MANUAL: '수동' };

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const DATETIME_TEXT_LENGTH = 16; // "yyyy-MM-ddTHH:mm"

/** 서버 LocalDateTime(ISO) → "yyyy-MM-dd HH:mm" */
const formatDateTime = (iso) => (iso ? iso.slice(0, DATETIME_TEXT_LENGTH).replace('T', ' ') : '-');

/** 실행 소요 시간 ("2시간 13분", 실행 중이면 현재까지) */
const formatDuration = (startedAt, endedAt) => {
    if (!startedAt) return '-';
    const end = endedAt ? new Date(endedAt) : new Date();
    const minutes = Math.max(0, Math.round((end - new Date(startedAt)) / MS_PER_MINUTE));
    const h = Math.floor(minutes / MINUTES_PER_HOUR);
    const m = minutes % MINUTES_PER_HOUR;
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};

const StatusBadge = ({ status }) => {
    const style = STATUS_STYLE[status] || { label: status, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${style.className}`}>
            {status === 'RUNNING' && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
            {style.label}
        </span>
    );
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

        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">실행 주기 변경</h3>
            <ScheduleEditor job={job} saving={saving} onSave={onSave} />
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">최근 실행 이력</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
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
        </div>
    </section>
);

export default ScheduleJobCard;
