import { Fragment, useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { LEVEL, formatMB } from '../monitoringModel';
import { REQUEST_FLOW, APP_LABEL } from '../podModel';
import { Panel, StatusDot } from './MonitoringUi';

const STATUS_LABEL = { [LEVEL.OK]: '정상', [LEVEL.WARN]: '주의', [LEVEL.DOWN]: '중단', [LEVEL.UNKNOWN]: '완료' };
// 요청이 지나가는 앱 전체 ('인터넷' 칸 강조용)
const FLOW_APPS = REQUEST_FLOW.flat();
const sameApps = (a, b) => a?.length === b?.length && a.every((x, i) => x === b[i]);

const CHIP_BORDER = {
    [LEVEL.OK]: 'border-slate-200 dark:border-slate-700',
    [LEVEL.WARN]: 'border-amber-400 dark:border-amber-600',
    [LEVEL.DOWN]: 'border-orange-500 dark:border-orange-500',
    [LEVEL.UNKNOWN]: 'border-dashed border-slate-300 dark:border-slate-600',
};

/**
 * 클러스터 구성도 — 요청 흐름 + 네임스페이스별 앱 묶음
 * - 흐름의 칸: 마우스를 올리거나 누르면 아래 구성도에서 그 앱을 강조 (누르면 고정, 다시 누르면 해제)
 * - 구성도의 칸: 누르면 아래 표를 그 앱으로 거름
 * @param {ReturnType<import('../podModel').buildPodMap>} map
 * @param {(namespace: string, app: string) => void} onSelect 칩 클릭 → 아래 표 거르기
 */
export default function PodMap({ map, node, podCount, onSelect }) {
    const [open, setOpen] = useState(true);
    const [pinned, setPinned] = useState(null);   // 눌러서 고정한 강조 대상 (앱 이름 배열)
    const [hovered, setHovered] = useState(null); // 마우스를 올린 동안의 강조 대상
    const highlight = hovered ?? pinned;
    const togglePin = useCallback((apps) => setPinned((prev) => (sameApps(prev, apps) ? null : apps)), []);
    const flowHandlers = (apps) => ({
        onClick: () => togglePin(apps),
        onMouseEnter: () => setHovered(apps),
        onMouseLeave: () => setHovered(null),
        onFocus: () => setHovered(apps),
        onBlur: () => setHovered(null),
        pressed: sameApps(pinned, apps),
    });
    const appByName = useMemo(() => {
        const m = new Map();
        map.forEach((g) => g.apps.forEach((a) => m.set(a.app, { ...a, namespace: g.namespace })));
        return m;
    }, [map]);

    return (
        <Panel
            title="클러스터 구성도"
            subtitle={`${node ? `노드 ${node} · ` : ''}파드 ${podCount}개 · 아래 상자의 칸을 누르면 표가 걸러짐`}
            actions={
                <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                    {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    {open ? '접기' : '펼치기'}
                </button>
            }
            bodyClassName={open ? 'p-4 space-y-5' : 'hidden'}
        >
            {/* 요청 흐름 */}
            <div>
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">사용자 요청 흐름</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">칸에 마우스를 올리거나 누르면 아래에서 위치를 보여줍니다 · 인터넷 = 흐름 전체</span>
                    {pinned && (
                        <button type="button" onClick={() => setPinned(null)} className="text-xs text-blue-600 hover:underline dark:text-blue-400">강조 해제</button>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                        const h = flowHandlers(FLOW_APPS);
                        return (
                            <button type="button" aria-pressed={h.pressed} onClick={h.onClick} onMouseEnter={h.onMouseEnter} onMouseLeave={h.onMouseLeave} onFocus={h.onFocus} onBlur={h.onBlur}
                                className={`inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${
                                    h.pressed ? 'border-blue-500 ring-2 ring-blue-500/40' : 'border-slate-200 dark:border-slate-700'
                                }`}>
                                <Globe className="h-4 w-4 text-slate-400" aria-hidden="true" />인터넷
                            </button>
                        );
                    })()}
                    {REQUEST_FLOW.map((step) => (
                        <Fragment key={step.join()}>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                            <div className={step.length > 1 ? 'flex flex-col gap-1.5' : ''}>
                                {step.map((app) => {
                                    const a = appByName.get(app);
                                    return (
                                        <AppChip key={app} compact app={a ?? { app, label: APP_LABEL[app], level: LEVEL.UNKNOWN, missing: true }}
                                            {...(a ? flowHandlers([app]) : {})}
                                            highlighted={!!pinned && pinned.includes(app)} />
                                    );
                                })}
                            </div>
                        </Fragment>
                    ))}
                </div>
            </div>

            {/* 네임스페이스 상자 */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {map.map((g) => (
                    <section key={g.namespace} aria-label={`${g.namespace} 네임스페이스`}
                        className={`rounded-xl border border-slate-200 bg-slate-50 p-3 transition-opacity dark:border-slate-700 dark:bg-slate-900/40 ${
                            highlight && !g.apps.some((a) => highlight.includes(a.app)) ? 'opacity-40' : ''
                        }`}>
                        <div className="mb-2.5 flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {g.namespace}
                                {g.desc && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{g.desc}</span>}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">앱 {g.apps.length}개</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {g.apps.map((a) => (
                                <AppChip key={a.key} app={a} onClick={() => onSelect(g.namespace, a.app)}
                                    highlighted={!!highlight && highlight.includes(a.app)} dimmed={!!highlight && !highlight.includes(a.app)} />
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            {/* 범례 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                {[LEVEL.OK, LEVEL.WARN, LEVEL.DOWN].map((l) => (
                    <span key={l} className="inline-flex items-center gap-1.5"><StatusDot level={l} />{STATUS_LABEL[l]}</span>
                ))}
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded border border-dashed border-slate-400" aria-hidden="true" />완료된 작업</span>
                <span>숫자 = 메모리 사용량 · ×N = 파드 수</span>
            </div>
        </Panel>
    );
}

function AppChip({ app, onClick, compact = false, highlighted = false, dimmed = false, pressed, onMouseEnter, onMouseLeave, onFocus, onBlur }) {
    const done = app.allDone;
    const title = [app.label, app.app, app.kind, app.missing ? '파드 없음' : ''].filter(Boolean).join(' · ');
    const body = (
        <>
            <span className="flex items-center gap-1.5">
                {!done && <StatusDot level={app.missing ? LEVEL.DOWN : app.level} />}
                <span className={`font-semibold ${done ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{app.label ?? app.app}</span>
                {app.podCount > 1 && <span className="text-xs text-slate-400 dark:text-slate-500">×{app.podCount}</span>}
            </span>
            {!compact && (
                <span className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {app.label && <span className="max-w-[11rem] truncate">{app.app}</span>}
                    {done ? <span>완료 {app.doneCount}개</span> : app.memoryMB > 0 && <span className="shrink-0">{formatMB(app.memoryMB)}</span>}
                </span>
            )}
            {app.missing && <span className="text-[11px] text-orange-600 dark:text-orange-400">파드 없음</span>}
        </>
    );
    const border = highlighted
        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/40 dark:border-blue-400 dark:bg-blue-900/30'
        : `bg-white dark:bg-slate-800 ${CHIP_BORDER[app.missing ? LEVEL.DOWN : done ? LEVEL.UNKNOWN : app.level]}`;
    const cls = `flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-[opacity,box-shadow] ${border} ${dimmed ? 'opacity-40' : ''}`;
    return onClick ? (
        <button type="button" title={title} aria-pressed={pressed} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onFocus={onFocus} onBlur={onBlur}
            className={`${cls} ${highlighted ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{body}</button>
    ) : (
        <div title={title} className={cls}>{body}</div>
    );
}
