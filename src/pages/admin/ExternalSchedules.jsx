import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { send } from '@/util/ClientUtil';
import Button from '@/component/common/button/Button';
import StatusBadge from '@/pages/admin/ScheduleStatusBadge';
import { formatDateTime } from '@/pages/admin/scheduleFormat';
import { modeLabel } from '@/pages/cointrade/strategy/strategyCommon';
import {
    DB_BACKUP_SCHEDULE, DB_BACKUP_HISTORY_URL, DB_BACKUP_HISTORY_LIMIT,
    STRATEGY_LIST_URL, STRATEGY_RUNS_URL, STRATEGY_MANAGE_PATH, STRATEGY_MARKET_TAB,
} from '@/config/scheduleExternal';

const MODE_OFF = 'OFF';
const MARKET_LABEL = { CRYPTO: '코인', KRX: '주식' };

const toHourText = (hour) => `${String(hour).padStart(2, '0')}:00`;

/** 조회 전용 카드 공통 틀 */
const ReadOnlyCard = ({ title, badge, description, items, footer }) => (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            {badge}
        </div>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {items.map(({ label, value }) => (
                <div key={label}>
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
                    <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-900 dark:text-white">{value}</dd>
                </div>
            ))}
        </dl>
        {footer && <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">{footer}</div>}
    </section>
);

const LastRun = ({ run, at }) => (run
    ? <>{formatDateTime(at)} <StatusBadge status={run.status} /></>
    : '이력 없음');

/** 자동매매 전략 카드 */
const StrategyCard = ({ strategy, lastRun }) => {
    const navigate = useNavigate();
    const isOff = strategy.mode === MODE_OFF;
    const tab = STRATEGY_MARKET_TAB[strategy.market];

    return (
        <ReadOnlyCard
            title={`자동매매 · ${MARKET_LABEL[strategy.market] || strategy.market}`}
            badge={<span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${isOff
                ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'}`}>
                {modeLabel(strategy.mode) || strategy.mode}
            </span>}
            description={strategy.name}
            items={[
                { label: '실행 주기', value: isOff ? '꺼짐' : `매일 ${toHourText(strategy.runHour)} 이후 1회` },
                { label: '관리 위치', value: '자동매매 화면 (trader 서비스)' },
                { label: '마지막 실행', value: <LastRun run={lastRun} at={lastRun?.createdAt} /> },
            ]}
            footer={
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{lastRun?.message || ' '}</p>
                    <Button variant="secondary" size="sm" onClick={() => navigate(STRATEGY_MANAGE_PATH, { state: { tab } })}>
                        자동매매 화면에서 변경
                    </Button>
                </div>
            }
        />
    );
};

/** DB 백업 카드 */
const DbBackupCard = ({ history }) => {
    const last = history[0];
    return (
        <ReadOnlyCard
            title={DB_BACKUP_SCHEDULE.label}
            badge={<span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">k8s CronJob</span>}
            description={DB_BACKUP_SCHEDULE.description}
            items={[
                { label: '실행 주기', value: DB_BACKUP_SCHEDULE.scheduleText },
                { label: '관리 위치', value: <span className="break-all text-xs">{DB_BACKUP_SCHEDULE.managedAt}</span> },
                { label: '마지막 실행', value: <LastRun run={last} at={last?.startedAt} /> },
            ]}
            footer={
                <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{DB_BACKUP_SCHEDULE.note}</p>
                    {history.length > 0 && (
                        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                            {history.map((h) => (
                                <li key={h.id} className="flex flex-wrap items-center gap-2">
                                    <span className="whitespace-nowrap">{formatDateTime(h.startedAt)}</span>
                                    <StatusBadge status={h.status} />
                                    <span className="break-all">{h.message || '-'}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            }
        />
    );
};

/**
 * 다른 곳에서 관리되는 스케줄 (조회 전용) — 자동매매 전략(trader), DB 백업(k8s CronJob)
 * - 부모의 새로고침 버튼에서 ref.refresh()로 함께 갱신
 */
const ExternalSchedules = forwardRef((_, ref) => {
    const [strategies, setStrategies] = useState([]);
    const [lastRuns, setLastRuns] = useState({});
    const [backupHistory, setBackupHistory] = useState([]);
    const [errors, setErrors] = useState([]);

    const fetchStrategies = useCallback(async () => {
        const { data, error } = await send(STRATEGY_LIST_URL, {}, 'GET');
        const list = data?.response?.strategies;
        if (error || !Array.isArray(list)) return '자동매매 전략';
        setStrategies(list);
        const runs = await Promise.all(list.map(async (s) => {
            const res = await send(`${STRATEGY_RUNS_URL}?strategy=${encodeURIComponent(s.id)}`, { limit: 1 }, 'GET');
            return [s.id, res.data?.response?.runs?.[0] || null];
        }));
        setLastRuns(Object.fromEntries(runs));
        return null;
    }, []);

    const fetchBackupHistory = useCallback(async () => {
        const { data, error } = await send(`${DB_BACKUP_HISTORY_URL}?limit=${DB_BACKUP_HISTORY_LIMIT}`, {}, 'GET');
        if (error || !Array.isArray(data?.response)) return 'DB 백업';
        setBackupHistory(data.response);
        return null;
    }, []);

    const refresh = useCallback(async () => {
        const failed = await Promise.all([fetchStrategies(), fetchBackupHistory()]);
        setErrors(failed.filter(Boolean));
    }, [fetchStrategies, fetchBackupHistory]);

    useImperativeHandle(ref, () => ({ refresh }), [refresh]);
    useEffect(() => { refresh(); }, [refresh]);

    return (
        <div className="mt-8">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">다른 곳에서 관리되는 스케줄</h2>
            <p className="mt-1 mb-4 text-sm text-slate-600 dark:text-slate-300">
                한눈에 보기 위한 <strong>조회 전용</strong>입니다. 주기 변경은 각 카드의 관리 위치에서 하세요.
            </p>
            {errors.length > 0 && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {errors.join(', ')} 정보를 불러오지 못했습니다.
                </p>
            )}
            <div className="space-y-4">
                {strategies.map((s) => <StrategyCard key={s.id} strategy={s} lastRun={lastRuns[s.id]} />)}
                <DbBackupCard history={backupHistory} />
            </div>
        </div>
    );
});

ExternalSchedules.displayName = 'ExternalSchedules';

export default ExternalSchedules;
