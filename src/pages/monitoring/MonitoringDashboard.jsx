import useSessionKeepAlive from '@/hooks/useSessionKeepAlive';
import useMonitoringSSE from './hooks/useMonitoringSSE';
import ServiceStatusCard from './components/ServiceStatusCard';
import ServiceTopology from './components/ServiceTopology';
import ExternalApiStatusCard from './components/ExternalApiStatusCard';
import ServiceActivityLog from './components/ServiceActivityLog';
import ResourceGauges from './components/ResourceGauges';
import ResourceTimeSeries from './components/ResourceTimeSeries';

/**
 * 실시간 모니터링 대시보드 메인 페이지
 * 라이트/다크 모드 연계 — 사이트 ThemeContext 기반
 */
export default function MonitoringDashboard() {
    const { snapshot, trades, apiLogs, isConnected, isPaused, togglePause, resourceHistory, traffic } = useMonitoringSSE();
    useSessionKeepAlive(true);

    const services = snapshot?.services || [];
    const resources = snapshot?.resources || null;


    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Real-Time Monitoring</div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={togglePause}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isPaused
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-slate-200 text-slate-500 border border-slate-300 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700'
                        }`}
                    >
                        {isPaused ? 'Paused' : 'Pause'}
                    </button>
                    <LiveIndicator isConnected={isConnected} />
                </div>
            </div>

            {/* Connection lost banner */}
            {!isConnected && (
                <div className="mb-4 rounded-lg bg-orange-500/10 border border-orange-500/30 px-4 py-2 text-sm text-orange-600 dark:text-orange-400 animate__animated animate__fadeIn" style={{ animationDuration: '0.3s' }}>
                    Connection lost — reconnecting...
                </div>
            )}

            {/* Main grid */}
            <div className="grid grid-cols-12 gap-4">
                {/* Left column: Service Topology + Activity */}
                <div className="col-span-12 lg:col-span-5 self-start space-y-4">
                    <DashCard title="Service Topology">
                        <ServiceTopology services={services} trades={trades} traffic={traffic} />
                    </DashCard>
                    <DashCard title="Service Activity">
                        <ServiceActivityLog apiLogs={apiLogs} />
                    </DashCard>
                </div>

                {/* Right column: 서비스 & 자원 모니터링 */}
                <div className="col-span-12 lg:col-span-7 self-start">
                    <GroupCard title="서비스 & 자원">
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {services.map((svc, i) => (
                                    <ServiceStatusCard key={svc.name || i} service={svc} />
                                ))}
                            </div>
                            <DashCard title="Resource Metrics (30min)" className="relative z-10">
                                <ResourceTimeSeries resourceHistory={resourceHistory} />
                            </DashCard>
                            <DashCard title="Resources">
                                <ResourceGauges resources={resources} />
                            </DashCard>
                        </div>
                    </GroupCard>
                </div>

                {/* Row 3: 외부 API 상태 */}
                <div className="col-span-12">
                    <GroupCard title="외부 API 상태">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {(snapshot?.externalApis || []).map((api, i) => (
                                <ExternalApiStatusCard key={api.name || i} api={api} />
                            ))}
                            {(!snapshot?.externalApis || snapshot.externalApis.length === 0) && (
                                <div className="col-span-full text-center text-sm text-slate-400 py-4">
                                    Checking external APIs...
                                </div>
                            )}
                        </div>
                    </GroupCard>
                </div>
            </div>
        </div>
    );
}

function LiveIndicator({ isConnected }) {
    return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
            isConnected
                ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                : 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30'
        }`}>
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-sky-400 animate-pulse' : 'bg-orange-400'}`} />
            {isConnected ? 'LIVE' : 'OFFLINE'}
        </div>
    );
}

function DashCard({ title, children, className = '' }) {
    return (
        <div className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 shadow-sm h-full ${className}`}>
            {title && (
                <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-3">{title}</div>
            )}
            {children}
        </div>
    );
}

function GroupCard({ title, children }) {
    return (
        <div className="rounded-xl border border-slate-300 bg-slate-100/50 dark:border-slate-700 dark:bg-slate-800/30 p-3 h-full">
            {title && (
                <div className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">{title}</div>
            )}
            {children}
        </div>
    );
}

