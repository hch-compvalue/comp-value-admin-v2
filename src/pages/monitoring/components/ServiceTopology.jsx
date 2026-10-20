import { useTheme } from '@/context/ThemeContext';
import { SLATE } from '@/config/themeColors';
import { SERVICE_LABEL } from '../monitoringModel';
import { Panel } from './MonitoringUi';

const NODE_W = 120;
const NODE_H = 36;

// id = 헬스체크 서비스 이름
const NODES = [
    { id: 'comp-value-admin', x: 280, y: 36 },
    { id: 'comp-value-service', x: 280, y: 112 },
    { id: 'trader', x: 100, y: 190 },
    { id: 'postgresql', x: 280, y: 190 },
    { id: 'redis', x: 460, y: 190 },
];
const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

// traffic: SSE traffic 이벤트의 키 (최근 요청 수)
const EDGES = [
    { from: 'comp-value-admin', to: 'comp-value-service', traffic: 'http' },
    { from: 'comp-value-service', to: 'trader', traffic: 'trader' },
    { from: 'comp-value-service', to: 'postgresql', traffic: 'db' },
    { from: 'comp-value-service', to: 'redis', traffic: 'redis' },
    { from: 'trader', to: 'postgresql', traffic: null },
];

// 트래픽 → 선 굵기 (없음·적음·보통·많음)
const TRAFFIC_LOW = 1;
const TRAFFIC_MID = 3;
const TRAFFIC_HIGH = 9;
const strokeWidthFor = (count) => (count >= TRAFFIC_HIGH ? 5 : count >= TRAFFIC_MID ? 3.5 : count >= TRAFFIC_LOW ? 2.5 : 1.5);

const STATUS_STROKE = { UP: '#0ea5e9', DEGRADED: '#f59e0b', DOWN: '#f97316' };
const ACTIVE_EDGE = '#3b82f6';
const DOWN_EDGE = '#f97316';

/** 서비스 연결도 — 노드 테두리 = 상태, 선 굵기 = 최근 트래픽, 끊긴 연결은 주황 점선 */
export default function ServiceTopology({ services = [], traffic = {} }) {
    const { isDark } = useTheme();
    const statusById = Object.fromEntries(services.map((s) => [s.name, s.status]));
    const idleEdge = SLATE[isDark ? 600 : 300];
    const nodeFill = isDark ? SLATE[900] : '#ffffff';
    const textColor = SLATE[isDark ? 100 : 800];

    return (
        <Panel title="서비스 연결도" subtitle="선 굵기 = 최근 트래픽">
            <svg viewBox="0 0 560 220" className="h-auto w-full" role="img" aria-label="웹 화면 → 백엔드 API → 자동매매·데이터베이스·캐시 연결 상태">
                {EDGES.map((e) => {
                    const from = NODE_BY_ID[e.from];
                    const to = NODE_BY_ID[e.to];
                    const broken = statusById[e.from] === 'DOWN' || statusById[e.to] === 'DOWN';
                    const count = e.traffic ? traffic[e.traffic] || 0 : 0;
                    return (
                        <line
                            key={`${e.from}-${e.to}`}
                            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                            stroke={broken ? DOWN_EDGE : count > 0 ? ACTIVE_EDGE : idleEdge}
                            strokeWidth={broken ? 2 : strokeWidthFor(count)}
                            strokeDasharray={broken ? '6 5' : undefined}
                            style={{ transition: 'stroke-width 300ms ease-out, stroke 300ms ease-out' }}
                        />
                    );
                })}
                {NODES.map((n) => {
                    const status = statusById[n.id];
                    const down = status === 'DOWN';
                    return (
                        <g key={n.id}>
                            <rect x={n.x - NODE_W / 2} y={n.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx="8"
                                fill={nodeFill} stroke={STATUS_STROKE[status] ?? idleEdge} strokeWidth={down ? 2 : 1.5} />
                            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="13" fill={down ? DOWN_EDGE : textColor}>
                                {SERVICE_LABEL[n.id] ?? n.id}{down ? ' · 중단' : ''}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </Panel>
    );
}
