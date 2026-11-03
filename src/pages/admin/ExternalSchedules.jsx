import { useNavigate } from 'react-router-dom';
import Button from '@/component/common/button/Button';
import StatusBadge from '@/pages/admin/ScheduleStatusBadge';
import { formatDateTime } from '@/pages/admin/scheduleFormat';
import { modeLabel } from '@/pages/cointrade/strategy/strategyCommon';
import { DB_BACKUP_SCHEDULE, STRATEGY_MANAGE_PATH, STRATEGY_MARKET_TAB } from '@/config/scheduleExternal';

const MODE_OFF = 'OFF';
const MARKET_LABEL = { CRYPTO: '코인', KRX: '주식' };
const MARKET_DAYS = { CRYPTO: '매일', KRX: '평일' };

const toHourText = (hour) => `${String(hour).padStart(2, '0')}:00`;

const ON_BADGE = 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
const OFF_BADGE = 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';

const LastRun = ({ run, at }) => (run
    ? <span className="flex flex-wrap items-center gap-2">{formatDateTime(at)} <StatusBadge status={run.status} /></span>
    : <span className="text-slate-400">이력 없음</span>);

/** 조회 전용 한 줄 — 이름·상태 / 주기 / 마지막 실행 / 관리 위치 */
const ReadOnlyRow = ({ title, badge, schedule, lastRun, manage, note }) => (
    <li className="grid grid-cols-1 gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-center md:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">{title}</span>
            {badge}
        </div>
        <div className="text-slate-700 dark:text-slate-300">{schedule}</div>
        <div className="text-slate-700 dark:text-slate-300">{lastRun}</div>
        <div className="md:text-right">{manage}</div>
        {note && <p className="text-xs text-slate-500 md:col-span-4 dark:text-slate-400">{note}</p>}
    </li>
);

/**
 * 다른 곳에서 관리되는 스케줄 (조회 전용) — 자동매매 전략(trader), DB 백업(k8s CronJob)
 * - 데이터는 부모가 useExternalSchedules 로 받아 타임라인과 함께 씀
 */
export default function ExternalSchedules({ strategies, lastRuns, backupHistory, errors }) {
    const navigate = useNavigate();
    const lastBackup = backupHistory[0];

    return (
        <section className="mt-8">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">다른 곳에서 관리되는 스케줄</h2>
            <p className="mt-1 mb-3 text-sm text-slate-600 dark:text-slate-300">
                한눈에 보기 위한 <strong>조회 전용</strong>입니다. 주기 변경은 각 관리 위치에서 하세요.
            </p>
            {errors.length > 0 && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {errors.join(', ')} 정보를 불러오지 못했습니다.
                </p>
            )}
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                {strategies.map((s) => {
                    const isOff = s.mode === MODE_OFF;
                    const run = lastRuns[s.id];
                    return (
                        <ReadOnlyRow
                            key={s.id}
                            title={`자동매매 · ${MARKET_LABEL[s.market] || s.market}`}
                            badge={<span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${isOff ? OFF_BADGE : ON_BADGE}`}>{modeLabel(s.mode) || s.mode}</span>}
                            schedule={isOff ? '꺼짐' : `${MARKET_DAYS[s.market] || ''} ${toHourText(s.runHour)} 이후 1회`}
                            lastRun={<LastRun run={run} at={run?.createdAt} />}
                            manage={(
                                <Button variant="secondary" size="sm" onClick={() => navigate(STRATEGY_MANAGE_PATH, { state: { tab: STRATEGY_MARKET_TAB[s.market] } })}>
                                    자동매매 화면에서 변경
                                </Button>
                            )}
                            note={run?.message ? `${s.name} · ${run.message}` : s.name}
                        />
                    );
                })}
                <ReadOnlyRow
                    title={DB_BACKUP_SCHEDULE.label}
                    badge={<span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ON_BADGE}`}>k8s CronJob</span>}
                    schedule={DB_BACKUP_SCHEDULE.scheduleText}
                    lastRun={<LastRun run={lastBackup} at={lastBackup?.startedAt} />}
                    manage={<span className="break-all text-xs text-slate-500 dark:text-slate-400">{DB_BACKUP_SCHEDULE.managedAt}</span>}
                    note={`${DB_BACKUP_SCHEDULE.description} · ${DB_BACKUP_SCHEDULE.note}`}
                />
            </ul>
        </section>
    );
}
