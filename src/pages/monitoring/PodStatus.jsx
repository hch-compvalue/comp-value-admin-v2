import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { send } from '@/util/ClientUtil';
import { TabActiveContext } from '@/context/TabContext';
import PageTitle from '@/component/common/display/PageTitle';
import Button from '@/component/common/button/Button';
import { LEVEL, formatAgo } from './monitoringModel';
import { NAMESPACE_DESC, TERMINATED_LABEL, toPodRows, groupByNamespace, isMassRestart, formatAge, shortImage } from './podModel';
import { Panel, StatusDot, UsageBar } from './components/MonitoringUi';
import { LEVEL_TEXT } from './components/levelStyles';

const PODS_API = '/dart/monitoring/pods';
// 탭을 보고 있을 때만 이 주기로 새로 받음
const REFRESH_MS = 10000;
const CLOCK_TICK_MS = 1000;
const ALL = '__all__';

const GRAFANA_LINKS = [
    { href: '/grafana/d/pod-resources', label: 'Grafana 파드 리소스' },
    { href: '/grafana/d/pod-logs', label: 'Grafana 파드 로그' },
];

const isProblem = (r) => r.state.level === LEVEL.DOWN || r.state.level === LEVEL.WARN;

/**
 * 실시간 대시보드 '파드' 탭 — 클러스터 전체 파드를 네임스페이스별로 (Prometheus 기반, 10초마다 갱신)
 */
export default function PodStatus() {
    const isActive = useContext(TabActiveContext) ?? true;
    const [pods, setPods] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchedAt, setFetchedAt] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [namespace, setNamespace] = useState(ALL);
    const [keyword, setKeyword] = useState('');
    const [hideDone, setHideDone] = useState(true);

    const fetchPods = useCallback(async () => {
        setLoading(true);
        const { data, error: err } = await send(PODS_API, null, 'GET');
        if (err) {
            setError(err);
        } else {
            setPods(data?.response || []);
            setError('');
            setFetchedAt(Date.now());
        }
        setLoading(false);
    }, []);

    // 탭이 보일 때만 주기 갱신
    useEffect(() => {
        if (!isActive) return undefined;
        fetchPods();
        const timer = setInterval(fetchPods, REFRESH_MS);
        return () => clearInterval(timer);
    }, [isActive, fetchPods]);

    useEffect(() => {
        if (!isActive) return undefined;
        const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
        return () => clearInterval(timer);
    }, [isActive]);

    const rows = useMemo(() => toPodRows(pods || []), [pods]);
    const massRestart = useMemo(() => isMassRestart(pods || []), [pods]);
    const allGroups = useMemo(() => groupByNamespace(rows), [rows]);

    const visibleGroups = useMemo(() => {
        const kw = keyword.trim().toLowerCase();
        return allGroups
            .filter((g) => namespace === ALL || g.namespace === namespace)
            .map((g) => ({
                ...g,
                pods: g.pods.filter((r) => (!hideDone || !r.state.done) && (!kw || r.name.toLowerCase().includes(kw))),
                hiddenDone: hideDone ? g.pods.filter((r) => r.state.done).length : 0,
            }))
            .filter((g) => g.pods.length > 0 || g.hiddenDone > 0);
    }, [allGroups, namespace, keyword, hideDone]);

    const total = rows.length;
    const running = rows.filter((r) => r.phase === 'Running').length;
    const done = rows.filter((r) => r.state.done).length;
    const problems = rows.filter(isProblem).length;
    const nodeCount = new Set(rows.map((r) => r.node).filter(Boolean)).size;

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-x-4">
                <PageTitle />
                <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
                    <span className="mr-1 text-slate-500 dark:text-slate-400">
                        마지막 갱신 <span className="text-slate-900 dark:text-white">{formatAgo(fetchedAt, now)}</span>
                    </span>
                    <Button variant="secondary" size="sm" onClick={fetchPods} disabled={loading}>
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />새로고침
                    </Button>
                    {GRAFANA_LINKS.map((l) => (
                        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                            {l.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                    ))}
                </div>
            </div>

            {error && (
                <div role="alert" className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                    파드 정보를 불러오지 못했습니다: {error}
                </div>
            )}
            {massRestart && (
                <div role="status" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    최근 1시간 안에 대부분의 파드가 함께 재시작했습니다. 서버(PC)가 재부팅된 것으로 보여 파드별 재시작 경고는 표시하지 않습니다.
                </div>
            )}

            <div className="space-y-5">
                {/* 요약 */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <SummaryTile label="전체 파드" value={total} sub={nodeCount ? `노드 ${nodeCount}개` : ''} />
                    <SummaryTile label="실행 중" value={running} />
                    <SummaryTile label="완료된 작업" value={done} sub="백업 등 Job" />
                    <SummaryTile label="문제" value={problems} sub={problems ? '아래 표 맨 위' : '없음'} level={problems ? LEVEL.WARN : LEVEL.OK} />
                </div>

                {/* 필터 */}
                <div className="flex flex-wrap items-center gap-3">
                    <div role="group" aria-label="네임스페이스" className="flex flex-wrap gap-1.5">
                        <NamespaceChip active={namespace === ALL} onClick={() => setNamespace(ALL)} label="전체" count={total} problems={problems} />
                        {allGroups.map((g) => (
                            <NamespaceChip key={g.namespace} active={namespace === g.namespace} onClick={() => setNamespace(g.namespace)}
                                label={g.namespace} count={g.pods.length} problems={g.problems} />
                        ))}
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-3">
                        <label className="relative">
                            <span className="sr-only">파드 이름 검색</span>
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <input type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="파드 이름 검색"
                                className="h-9 w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
                        </label>
                        <label htmlFor="pod-hide-done" className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <input id="pod-hide-done" type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="h-4 w-4" />
                            완료된 작업 숨기기
                        </label>
                    </div>
                </div>

                {/* 네임스페이스별 표 */}
                {pods === null && !error ? (
                    <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">파드 정보를 불러오는 중입니다.</div>
                ) : visibleGroups.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">조건에 맞는 파드가 없습니다.</div>
                ) : (
                    visibleGroups.map((g) => (
                        <Panel key={g.namespace} bodyClassName=""
                            title={<span className="inline-flex items-center gap-2">{g.namespace}{g.problems > 0 && <StatusDot level={LEVEL.WARN} />}</span>}
                            subtitle={`${NAMESPACE_DESC[g.namespace] ? `${NAMESPACE_DESC[g.namespace]} · ` : ''}${g.pods.length}개${g.hiddenDone ? ` · 완료 ${g.hiddenDone}개 숨김` : ''}`}>
                            {g.pods.length > 0 && <PodTable pods={g.pods} now={now} />}
                        </Panel>
                    ))
                )}
            </div>
        </>
    );
}

function SummaryTile({ label, value, sub, level = LEVEL.OK }) {
    return (
        <div className={`flex flex-col gap-1.5 rounded-xl border bg-white p-4 dark:bg-slate-800 ${level === LEVEL.OK ? 'border-slate-200 dark:border-slate-700' : 'border-amber-300 dark:border-amber-700'}`}>
            <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
            <span className="flex items-baseline gap-1.5">
                <span className={`text-xl font-bold ${level === LEVEL.OK ? 'text-slate-900 dark:text-white' : LEVEL_TEXT[level]}`}>{value}</span>
                {sub && <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span>}
            </span>
        </div>
    );
}

function NamespaceChip({ active, onClick, label, count, problems }) {
    return (
        <button type="button" aria-pressed={active} onClick={onClick}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${
                active
                    ? 'border-transparent bg-brand text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}>
            {problems > 0 && <StatusDot level={LEVEL.WARN} />}
            {label}
            <span className={active ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}>{count}</span>
        </button>
    );
}

function PodTable({ pods, now }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <th className="px-4 py-2.5">파드</th>
                        <th className="w-32 px-3 py-2.5">상태</th>
                        <th className="w-16 px-3 py-2.5 text-right">준비</th>
                        <th className="w-28 px-3 py-2.5 text-right" title="누적값은 PC 재부팅마다 늘어납니다">재시작</th>
                        <th className="w-16 px-3 py-2.5 text-right">나이</th>
                        <th className="w-64 px-3 py-2.5">이미지</th>
                        <th className="w-64 px-3 py-2.5">CPU</th>
                        <th className="w-64 px-4 py-2.5">메모리</th>
                    </tr>
                </thead>
                <tbody>
                    {pods.map((r) => (
                        <tr key={r.key} className={`border-t border-slate-100 first:border-t-0 dark:border-slate-700/60 ${
                            r.state.level === LEVEL.DOWN ? 'bg-orange-50/70 dark:bg-orange-950/30' : r.state.level === LEVEL.WARN ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''
                        } ${r.state.done ? 'text-slate-400' : ''}`}>
                            <td className="max-w-0 px-4 py-2.5">
                                <div className="truncate font-medium text-slate-900 dark:text-white" title={r.name}>{r.name}</div>
                                {r.ownerKind && <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{r.ownerKind}</div>}
                            </td>
                            <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1.5 ${LEVEL_TEXT[r.state.level]} ${r.state.level === LEVEL.OK ? '' : 'font-semibold'}`}>
                                    <StatusDot level={r.state.level} />{r.state.label}
                                </span>
                                {r.lastTerminatedReason === 'OOMKilled' && (
                                    <div className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">직전: {TERMINATED_LABEL.OOMKilled}</div>
                                )}
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">
                                {r.totalContainers ? `${r.readyContainers}/${r.totalContainers}` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                                <span className="text-slate-600 dark:text-slate-300" title={r.lastTerminatedReason ? `직전 종료: ${TERMINATED_LABEL[r.lastTerminatedReason] ?? r.lastTerminatedReason}` : undefined}>
                                    {r.restarts}
                                </span>
                                {r.recentRestart && (
                                    <div className="mt-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">1시간 내 {r.restartsLastHour}회</div>
                                )}
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">{formatAge(r.createdAt, now)}</td>
                            <td className="max-w-0 px-3 py-2.5">
                                {(r.images || []).map((img) => (
                                    <div key={img} className="truncate text-xs text-slate-600 dark:text-slate-300" title={img}>{shortImage(img)}</div>
                                ))}
                            </td>
                            <td className="px-3 py-2.5">{r.state.done ? <span className="text-xs">—</span> : <UsageBar usage={r.cpu} />}</td>
                            <td className="px-4 py-2.5">{r.state.done ? <span className="text-xs">—</span> : <UsageBar usage={r.mem} />}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
