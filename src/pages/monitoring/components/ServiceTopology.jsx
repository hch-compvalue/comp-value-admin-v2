import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useTheme } from '@/context/ThemeContext';

const R = 24;

const NODES = [
    { id: 'comp-value-admin',   label: 'Web',         x: 200, y: 40 },
    { id: 'comp-value-service', label: 'Backend',      x: 200, y: 130 },
    { id: 'trader',             label: 'Trader',       x: 70,  y: 240 },
    { id: 'postgresql',         label: 'PostgreSQL',   x: 200, y: 240 },
    { id: 'redis',              label: 'Redis',        x: 330, y: 240 },
];

const EDGES = [
    { from: 'comp-value-admin',   to: 'comp-value-service' },
    { from: 'comp-value-service', to: 'trader' },
    { from: 'comp-value-service', to: 'postgresql' },
    { from: 'comp-value-service', to: 'redis' },
    { from: 'trader',             to: 'postgresql' },
];

const TRADE_EDGES = [
    'trader->postgresql',
    'comp-value-service->trader',
    'comp-value-service->postgresql',
];
const TRADE_PULSE_NODES = ['trader', 'postgresql', 'comp-value-service'];

const TRAFFIC_EDGE_MAP = {
    http:       ['comp-value-admin->comp-value-service'],
    db:         ['comp-value-service->postgresql'],
    redis:      ['comp-value-service->redis'],
    trader: ['comp-value-service->trader'],
};

// 엣지 key → CSS animation name 매핑 + 각도
const EDGE_ANIM = {};
const EDGE_ANGLE = {};
EDGES.forEach((edge, idx) => {
    const key = `${edge.from}->${edge.to}`;
    EDGE_ANIM[key] = `comet-e${idx}`;
    const from = NODES.find(n => n.id === edge.from);
    const to = NODES.find(n => n.id === edge.to);
    EDGE_ANGLE[key] = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
});

// 코멧 설정 — [rx, ry, opacity]: 머리는 원형, 꼬리는 이동 방향으로 늘어난 타원
const COMET_DURATION = 1.2;
const COMET_LIFETIME = 2200;
// [rx, ry, fillOpacity, strokeOpacity]
const COMET_TRAIL = [
    [3.5, 3.5, 0.25, 0.6],
    [6, 2, 0.15, 0.4],
    [8, 1.5, 0.1, 0.3],
    [10, 1.2, 0.06, 0.2],
    [12, 1, 0.03, 0.12],
    [14, 0.8, 0.015, 0.06],
    [15, 0.6, 0.01, 0.03],
];
const COMET_TRAIL_GAP = 0.06;
const MAX_TOTAL_COMETS = 200;

const PRESSURE_COLORS = ['#7dd3fc', '#fbbf24', '#f87171'];

// edgeId → trafficKey 역매핑
const EDGE_TRAFFIC_KEY = {};
for (const [key, edges] of Object.entries(TRAFFIC_EDGE_MAP)) {
    for (const edgeId of edges) EDGE_TRAFFIC_KEY[edgeId] = key;
}

/* CSS keyframes — 컴포넌트 마운트 시 1회 주입 */
const STYLE_ID = 'topology-anim-styles';
function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    let css = `
        @keyframes topo-pulse-ring {
            0%   { transform: scale(1); opacity: 0.9; }
            100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes topo-pulse-ring2 {
            0%   { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes topo-edge-flash {
            0%   { opacity: 1; }
            100% { opacity: 0; }
        }
        @keyframes topo-label-fade {
            0%   { opacity: 1; }
            70%  { opacity: 1; }
            100% { opacity: 0; }
        }
    `;

    // 각 엣지별 코멧 이동 keyframes (CSS transform 기반 — 요소 삽입 시점 기준)
    EDGES.forEach((edge, idx) => {
        const from = NODES.find(n => n.id === edge.from);
        const to = NODES.find(n => n.id === edge.to);
        css += `
            @keyframes comet-e${idx} {
                0%   { transform: translate(${from.x}px, ${from.y}px); opacity: 1; }
                85%  { transform: translate(${to.x}px, ${to.y}px); opacity: 1; }
                100% { transform: translate(${to.x}px, ${to.y}px); opacity: 0; }
            }
        `;
    });

    style.textContent = css;
    document.head.appendChild(style);
}

export default function ServiceTopology({ services = [], trades = [], traffic = {} }) {
    const { isDark } = useTheme();
    const [pulseNodes, setPulseNodes] = useState(new Set());
    const [flashEdges, setFlashEdges] = useState(new Set());
    const [tradeFlash, setTradeFlash] = useState(null);
    const [animKey, setAnimKey] = useState(0);
    const prevTradeCountRef = useRef(0);

    const [comets, setComets] = useState([]);
    const cometIdRef = useRef(0);

    const edgePressure = useMemo(() => {
        const map = {};
        for (const [edgeId, trafficKey] of Object.entries(EDGE_TRAFFIC_KEY)) {
            const count = traffic[trafficKey] || 0;
            map[edgeId] = count > 8 ? 2 : count >= 3 ? 1 : 0;
        }
        return map;
    }, [traffic]);

    const lineColor = isDark ? '#334155' : '#cbd5e1';
    const statusTextColor = isDark ? '#94a3b8' : '#64748b';
    const particleColor = isDark ? '#06b6d4' : '#0e7490';

    useEffect(() => { injectStyles(); }, []);

    const statusMap = useMemo(() => {
        const map = {};
        for (const svc of services) map[svc.name] = svc.status;
        return map;
    }, [services]);

    const activeTrafficEdges = useMemo(() => {
        const edges = new Set();
        for (const c of comets) edges.add(c.edgeId);
        return edges;
    }, [comets]);

    // 만료 코멧 주기 정리
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setComets(prev => prev.filter(c => now - c.createdAt < COMET_LIFETIME));
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    // 트래픽 코멧 생성
    useEffect(() => {
        const now = Date.now();
        const newComets = [];
        for (const [key, edgeList] of Object.entries(TRAFFIC_EDGE_MAP)) {
            const count = traffic[key] || 0;
            if (count <= 0) continue;
            const numComets = count;
            for (let i = 0; i < numComets; i++) {
                for (const edgeId of edgeList) {
                    cometIdRef.current++;
                    newComets.push({ edgeId, id: cometIdRef.current, delay: Math.random() * 0.8, createdAt: now });
                }
            }
        }
        if (newComets.length === 0) return;
        setComets(prev => {
            const alive = prev.filter(c => now - c.createdAt < COMET_LIFETIME);
            const combined = [...alive, ...newComets];
            return combined.length > MAX_TOTAL_COMETS ? combined.slice(-MAX_TOTAL_COMETS) : combined;
        });
    }, [traffic]);

    // 코인 거래 애니메이션
    const triggerTradeAnimation = useCallback((trade) => {
        setPulseNodes(new Set(TRADE_PULSE_NODES));
        setFlashEdges(new Set(TRADE_EDGES));
        setAnimKey(prev => prev + 1);
        if (trade) setTradeFlash(`${trade.tradeType} ${trade.coinCode}`);
        const timer = setTimeout(() => {
            setPulseNodes(new Set());
            setFlashEdges(new Set());
            setTradeFlash(null);
        }, 2200);
        return timer;
    }, []);

    useEffect(() => {
        if (trades.length > prevTradeCountRef.current && trades.length > 0) {
            const timer = triggerTradeAnimation(trades[0]);
            prevTradeCountRef.current = trades.length;
            return () => clearTimeout(timer);
        }
        prevTradeCountRef.current = trades.length;
    }, [trades, triggerTradeAnimation]);

    const getNodeColor = (nodeId) => {
        const status = statusMap[nodeId] || 'UNKNOWN';
        if (status === 'UP') return { fill: '#059669', stroke: '#34d399', glow: 'rgba(52,211,153,0.4)' };
        if (status === 'DEGRADED') return { fill: '#d97706', stroke: '#fbbf24', glow: 'rgba(251,191,36,0.4)' };
        if (status === 'DOWN') return { fill: '#dc2626', stroke: '#f87171', glow: 'rgba(248,113,113,0.4)' };
        return { fill: '#475569', stroke: '#94a3b8', glow: 'rgba(148,163,184,0.3)' };
    };

    const getNode = (id) => NODES.find(n => n.id === id);
    const edgeKey = (from, to) => `${from}->${to}`;

    return (
        <div className="w-full">
            <svg viewBox="0 0 425 300" className="w-full h-auto">
                <defs>
                    <radialGradient id="particleGrad">
                        <stop offset="0%" stopColor={particleColor} stopOpacity="1" />
                        <stop offset="100%" stopColor={particleColor} stopOpacity="0" />
                    </radialGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <filter id="glowStrong">
                        <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <filter id="cometGlow">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                </defs>

                {/* ── Edges ── */}
                {EDGES.map(edge => {
                    const from = getNode(edge.from);
                    const to = getNode(edge.to);
                    if (!from || !to) return null;
                    const pathId = `path-${edge.from}-${edge.to}`;
                    const key = edgeKey(edge.from, edge.to);
                    const isFlashing = flashEdges.has(key);
                    const hasComet = activeTrafficEdges.has(key);

                    return (
                        <g key={pathId}>
                            {isFlashing && (
                                <line
                                    key={`flash-${key}-${animKey}`}
                                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                    stroke="#22d3ee" strokeWidth="5" filter="url(#glowStrong)"
                                    style={{ animation: 'topo-edge-flash 2s ease-out forwards' }}
                                />
                            )}

                            <line
                                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                stroke={isFlashing ? '#22d3ee' : hasComet ? PRESSURE_COLORS[edgePressure[key] || 0] : lineColor}
                                strokeWidth={isFlashing ? 2.5 : 1.5}
                                strokeDasharray={isFlashing || hasComet ? undefined : '4 4'}
                                opacity={hasComet ? 0.5 : 1}
                                style={{ transition: 'all 0.3s' }}
                            />

                            {/* 유휴 파티클 (animateMotion — 페이지 로드 시 시작, 무한 반복이라 문제 없음) */}
                            <path id={pathId} d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} fill="none" stroke="none" />
                            {!hasComet && (
                                <circle r="2.5" fill="url(#particleGrad)" filter="url(#glow)" opacity="0.5">
                                    <animateMotion dur="3.5s" repeatCount="indefinite">
                                        <mpath href={`#${pathId}`} />
                                    </animateMotion>
                                </circle>
                            )}
                        </g>
                    );
                })}

                {/* ── 트래픽 코멧 (CSS animation — 요소 삽입 시점 기준) ── */}
                {comets.map(comet => {
                    const animName = EDGE_ANIM[comet.edgeId];
                    const angle = EDGE_ANGLE[comet.edgeId] || 0;
                    if (!animName) return null;
                    const color = PRESSURE_COLORS[edgePressure[comet.edgeId] || 0];
                    return (
                        <g key={`comet-${comet.id}`}>
                            {COMET_TRAIL.map(([rx, ry, fillOp, strokeOp], idx) => (
                                <g
                                    key={idx}
                                    style={{
                                        animation: `${animName} ${COMET_DURATION}s linear ${comet.delay + idx * COMET_TRAIL_GAP}s both`,
                                    }}
                                >
                                    <ellipse
                                        cx="0" cy="0" rx={rx} ry={ry}
                                        fill={color}
                                        fillOpacity={fillOp}
                                        stroke={color}
                                        strokeWidth={idx === 0 ? 1 : 0.5}
                                        strokeOpacity={strokeOp}
                                        transform={`rotate(${angle})`}
                                        filter={idx === 0 ? 'url(#cometGlow)' : undefined}
                                    />
                                </g>
                            ))}
                        </g>
                    );
                })}

                {/* ── Nodes ── */}
                {NODES.map(node => {
                    const colors = getNodeColor(node.id);
                    const isPulsing = pulseNodes.has(node.id);

                    return (
                        <g key={node.id}>
                            {isPulsing && (
                                <>
                                    <circle
                                        key={`pulse1-${node.id}-${animKey}`}
                                        cx={node.x} cy={node.y} r={R}
                                        fill="none" stroke="#22d3ee" strokeWidth="3"
                                        style={{
                                            transformOrigin: `${node.x}px ${node.y}px`,
                                            animation: 'topo-pulse-ring 1.5s ease-out forwards',
                                        }}
                                    />
                                    <circle
                                        key={`pulse2-${node.id}-${animKey}`}
                                        cx={node.x} cy={node.y} r={R}
                                        fill="none" stroke="#22d3ee" strokeWidth="2"
                                        style={{
                                            transformOrigin: `${node.x}px ${node.y}px`,
                                            animation: 'topo-pulse-ring2 1s ease-out forwards',
                                        }}
                                    />
                                </>
                            )}

                            <circle
                                cx={node.x} cy={node.y} r={R + 4}
                                fill="none" stroke={colors.stroke} strokeWidth="1" opacity="0.3"
                                style={{ filter: `drop-shadow(0 0 6px ${colors.glow})` }}
                            />

                            <circle
                                cx={node.x} cy={node.y} r={R}
                                fill={isPulsing ? '#0e7490' : colors.fill}
                                stroke={isPulsing ? '#22d3ee' : colors.stroke}
                                strokeWidth={isPulsing ? 3 : 2}
                                style={{
                                    filter: isPulsing
                                        ? 'drop-shadow(0 0 14px rgba(34,211,238,0.8))'
                                        : `drop-shadow(0 0 5px ${colors.glow})`,
                                    transition: 'all 0.3s',
                                }}
                            />

                            <text x={node.x} y={node.y + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill="white">
                                {node.label}
                            </text>
                            <text x={node.x} y={node.y + R + 14} textAnchor="middle" fontSize="8" fill={statusTextColor}>
                                {statusMap[node.id] || '...'}
                            </text>
                        </g>
                    );
                })}

                {tradeFlash && (
                    <g key={`trade-label-${animKey}`}
                       style={{ animation: 'topo-label-fade 2s ease-out forwards' }}>
                        <rect x="100" y="125" width="140" height="26" rx="6"
                            fill={isDark ? 'rgba(8,145,178,0.95)' : 'rgba(6,182,212,0.95)'}
                            stroke="#22d3ee" strokeWidth="1"
                            filter="url(#glowStrong)"
                        />
                        <text x="170" y="143" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
                            {tradeFlash}
                        </text>
                    </g>
                )}
            </svg>
        </div>
    );
}
