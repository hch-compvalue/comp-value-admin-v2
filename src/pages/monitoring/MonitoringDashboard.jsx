import { useEffect, useMemo, useState } from 'react';
import useSessionKeepAlive from '@/hooks/useSessionKeepAlive';
import PageTitle from '@/component/common/display/PageTitle';
import Button from '@/component/common/button/Button';
import useMonitoringSSE from './hooks/useMonitoringSSE';
import { LEVEL, WARN_PCT, buildServiceRows, buildIssues, countRecentErrors, formatAgo } from './monitoringModel';
import { Panel, StatusDot } from './components/MonitoringUi';
import StatusSummary from './components/StatusSummary';
import ServiceTable from './components/ServiceTable';
import ResourceTimeSeries from './components/ResourceTimeSeries';
import RequestLog from './components/RequestLog';
import ServiceTopology from './components/ServiceTopology';
import ExternalApiList from './components/ExternalApiList';

// snapshot 이 없을 때 쓰는 고정 빈 배열 (매 렌더 새 배열이면 useMemo 가 매번 다시 계산)
const EMPTY = [];
// "N초 전" 표시 갱신 주기
const CLOCK_TICK_MS = 1000;

/** 1초마다 현재 시각 (마지막 갱신·최근 5분 오류 계산용) */
function useNow() {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
        return () => clearInterval(timer);
    }, []);
    return now;
}

const levelOf = (bad, warnOnly = false) => (bad ? (warnOnly ? LEVEL.WARN : LEVEL.DOWN) : LEVEL.OK);

/**
 * 실시간 모니터링 — 요약(이상 여부) → 서비스 표 → 리소스 추이·요청 로그 → 연결도·외부 API
 */
export default function MonitoringDashboard() {
    const { snapshot, apiLogs, isConnected, isPaused, togglePause, resourceHistory, traffic } = useMonitoringSSE();
    useSessionKeepAlive(true);
    const now = useNow();

    const services = snapshot?.services ?? EMPTY;
    const externalApis = snapshot?.externalApis ?? EMPTY;

    const rows = useMemo(() => buildServiceRows(services, snapshot?.resources), [services, snapshot?.resources]);
    const recentErrors = countRecentErrors(apiLogs, now);
    const issues = useMemo(() => buildIssues(rows, externalApis, recentErrors), [rows, externalApis, recentErrors]);

    const upServices = services.filter((s) => s.status === 'UP').length;
    const upApis = externalApis.filter((a) => a.status === 'UP').length;
    const hotRows = rows.filter((r) => [r.cpu?.pct, r.mem?.pct].some((p) => p != null && p >= WARN_PCT)).length;

    const kpis = [
        { label: '서비스', value: `${upServices} / ${services.length}`, sub: upServices === services.length ? '정상' : `${services.length - upServices}개 이상`, level: levelOf(upServices < services.length), anchor: 'services' },
        { label: '외부 API', value: `${upApis} / ${externalApis.length}`, sub: upApis === externalApis.length ? '정상' : `${externalApis.length - upApis}개 이상`, level: levelOf(upApis < externalApis.length), anchor: 'external-apis' },
        { label: '오류 응답 (5xx)', value: `${recentErrors}건`, sub: '최근 5분', level: levelOf(recentErrors > 0), anchor: 'request-log' },
        { label: '리소스 주의', value: `${hotRows}개`, sub: `사용률 ${WARN_PCT}% 이상`, level: levelOf(hotRows > 0, true), anchor: 'services' },
    ];

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-x-4">
                <PageTitle />
                <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                        마지막 갱신 <span className="text-slate-900 dark:text-white">{formatAgo(snapshot?.timestamp, now)}</span>
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                        isConnected ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                    }`}>
                        <StatusDot level={isConnected ? LEVEL.OK : LEVEL.DOWN} />
                        {isConnected ? '연결됨' : '연결 끊김'}
                    </span>
                    <Button variant="secondary" size="sm" onClick={togglePause} aria-pressed={isPaused}>
                        {isPaused ? '다시 받기' : '일시정지'}
                    </Button>
                </div>
            </div>

            {!isConnected && (
                <div role="status" className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                    서버와 연결이 끊겼습니다. 다시 연결하는 중입니다.
                </div>
            )}
            {isPaused && (
                <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    일시정지 중입니다. 그래프와 로그가 멈춰 있습니다.
                </div>
            )}

            <div className="space-y-5">
                <StatusSummary issues={issues} kpis={kpis} loading={!snapshot} />

                <Panel id="services" title="서비스" subtitle={`CPU·메모리는 한도 대비 사용률 · ${WARN_PCT}% 이상 주의`} bodyClassName="">
                    <ServiceTable rows={rows} />
                </Panel>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <ResourceTimeSeries resourceHistory={resourceHistory} />
                    <RequestLog id="request-log" apiLogs={apiLogs} />
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    <ServiceTopology services={services} traffic={traffic} />
                    <ExternalApiList id="external-apis" apis={externalApis} />
                </div>
            </div>
        </>
    );
}
