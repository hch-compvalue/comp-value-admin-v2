/**
 * 실시간 모니터링 화면 데이터 가공 — SSE snapshot(서비스 상태 + Prometheus 리소스)을 화면용 행으로 합침
 * 상태 단계(색각이상 친화): 정상 sky · 주의 amber · 중단 orange
 */

// 리소스 사용률 경고 기준 (%)
export const WARN_PCT = 70;
export const CRITICAL_PCT = 90;
// 오류 응답 집계 구간
export const ERROR_WINDOW_MS = 5 * 60 * 1000;
// 외부 API 응답 시간 기준 (ms)
export const API_SLOW_MS = 500;
export const API_VERY_SLOW_MS = 2000;

const MB_PER_GB = 1024;
const PERCENT = 100;

/**
 * 서비스 목록 — 헬스체크 이름(status)과 쿠버네티스 파드 이름(pod)이 달라 여기서 짝지음
 * 목록에 없는 서비스·파드도 원래 이름 그대로 표시됨
 */
const SERVICE_META = [
    { label: '백엔드 API', status: 'comp-value-service', pod: 'comp-value-service' },
    { label: '자동매매', status: 'trader', pod: 'trader-api' },
    { label: '웹 화면', status: 'comp-value-admin', pod: 'comp-value-web' },
    { label: '데이터베이스', status: 'postgresql', pod: 'postgres' },
    { label: '캐시', status: 'redis', pod: 'redis' },
];

/** 외부 API 설명 (없으면 비워 둠) */
export const EXTERNAL_API_DESC = {
    FMP: '미국 주식 시세·재무',
    DART: '국내 공시',
    Upbit: '코인 시세',
    OpenAI: '기업명 영문 번역',
};

/** 화면 연결도 노드 id(헬스체크 이름) → 한글 이름 */
export const SERVICE_LABEL = Object.fromEntries(SERVICE_META.map((m) => [m.status, m.label]));

/** 파드 이름 → 한글 이름 (차트 범례용) */
export const POD_LABEL = Object.fromEntries(SERVICE_META.map((m) => [m.pod, m.label]));

export const LEVEL = { OK: 'ok', WARN: 'warn', DOWN: 'down', UNKNOWN: 'unknown' };
const LEVEL_ORDER = { [LEVEL.DOWN]: 0, [LEVEL.WARN]: 1, [LEVEL.UNKNOWN]: 2, [LEVEL.OK]: 3 };
const ISSUE_TAG_ORDER = { 중단: 0, 오류: 1, 주의: 2 };

/** 사용률(%) → 단계 */
export const usageLevel = (pct) => (pct >= CRITICAL_PCT ? LEVEL.DOWN : pct >= WARN_PCT ? LEVEL.WARN : LEVEL.OK);

/** "3h 12m" / "2d 4h" → "3시간 12분" / "2일 4시간" (빈 값·"null" 은 null) */
export function formatUptime(raw) {
    if (!raw || raw === 'null') return null;
    return raw.replace(/(\d+)\s*d/g, '$1일').replace(/(\d+)\s*h/g, '$1시간').replace(/(\d+)\s*m(?!s)/g, '$1분').replace(/(\d+)\s*s/g, '$1초');
}

/** MB → "512 MB" / "1.5 GB" */
export function formatMB(mb) {
    return mb >= MB_PER_GB ? `${(mb / MB_PER_GB).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/** 파드 CPU — cpuPercent 는 코어 1개 기준 % (150 = 1.5코어) */
function cpuUsage(c) {
    const cores = Math.max(c.cpuPercent || 0, 0) / PERCENT;
    if (c.cpuLimitCores > 0) {
        return { pct: Math.min((cores / c.cpuLimitCores) * PERCENT, PERCENT), text: `${cores.toFixed(2)} / ${c.cpuLimitCores} 코어` };
    }
    return { pct: Math.min(cores * PERCENT, PERCENT), text: `${cores.toFixed(2)} 코어 (한도 없음)` };
}

function memUsage(c) {
    if (c.memoryLimitMB > 0) {
        return { pct: Math.min((c.memoryMB / c.memoryLimitMB) * PERCENT, PERCENT), text: `${formatMB(c.memoryMB)} / ${formatMB(c.memoryLimitMB)}` };
    }
    return { pct: null, text: `${formatMB(c.memoryMB || 0)} (한도 없음)` };
}

function rowLevel(status, cpu, mem) {
    if (status === 'DOWN') return LEVEL.DOWN;
    const usage = [cpu?.pct, mem?.pct].filter((p) => p != null);
    const worst = usage.length ? Math.max(...usage) : 0;
    if (status === 'DEGRADED' || worst >= WARN_PCT) return LEVEL.WARN;
    return status === 'UP' ? LEVEL.OK : LEVEL.UNKNOWN;
}

/**
 * 서비스 상태 + 파드 리소스 → 서비스 표 행 (문제 있는 행이 위로)
 * @returns {{key,label,orig,status,level,uptime,cpu,mem,isGpu}[]}
 */
export function buildServiceRows(services = [], resources = null) {
    const containers = resources?.containers || [];
    const statusByName = new Map(services.map((s) => [s.name, s]));
    const podByName = new Map(containers.map((c) => [c.name, c]));
    const usedStatus = new Set();
    const usedPods = new Set();
    const rows = [];

    const addRow = (label, orig, svc, pod) => {
        const cpu = pod ? cpuUsage(pod) : null;
        const mem = pod ? memUsage(pod) : null;
        rows.push({
            key: orig,
            label,
            orig,
            status: svc?.status ?? null,
            level: rowLevel(svc?.status, cpu, mem),
            uptime: formatUptime(svc?.uptime),
            cpu,
            mem,
        });
    };

    SERVICE_META.forEach((m) => {
        const svc = statusByName.get(m.status);
        const pod = podByName.get(m.pod);
        if (!svc && !pod) return;
        usedStatus.add(m.status);
        usedPods.add(m.pod);
        addRow(m.label, m.pod, svc, pod);
    });
    // 목록에 없는 파드·서비스 (롤링 배포 중 같은 이름 파드가 둘이면 둘 다 표시)
    containers.forEach((c, i) => {
        if (usedPods.has(c.name) && podByName.get(c.name) === c) return;
        addRow(POD_LABEL[c.name] ?? c.name, `${c.name}${usedPods.has(c.name) ? ` #${i + 1}` : ''}`, null, c);
    });
    services.forEach((s) => {
        if (!usedStatus.has(s.name)) addRow(s.name, s.name, s, null);
    });

    const gpu = resources?.gpu;
    if (gpu) {
        const util = Math.min(Math.max(gpu.utilPercent || 0, 0), PERCENT);
        const vram = gpu.memTotalMB > 0 ? Math.min((gpu.memUsedMB / gpu.memTotalMB) * PERCENT, PERCENT) : null;
        const cpu = { pct: util, text: `사용률 ${util.toFixed(0)}%` };
        const mem = { pct: vram, text: `${formatMB(gpu.memUsedMB)} / ${formatMB(gpu.memTotalMB)}` };
        rows.push({ key: 'gpu', label: 'GPU', orig: 'NVIDIA', status: null, level: rowLevel('UP', cpu, mem), uptime: null, cpu, mem, isGpu: true });
    }

    // 문제 있는 행을 위로 (같은 단계는 원래 순서 유지)
    return rows
        .map((r, i) => ({ r, i }))
        .sort((a, b) => LEVEL_ORDER[a.r.level] - LEVEL_ORDER[b.r.level] || a.i - b.i)
        .map(({ r }) => r);
}

/**
 * 외부 API 상태 (백엔드 ExternalApiHealthService 와 같은 값)
 * - NOT_CONFIGURED(키 없음)·DISABLED(대시보드에서 끔)는 오류가 아님 → 요약 숫자·주의 목록에서 제외
 */
export const API_STATUS = { UP: 'UP', DOWN: 'DOWN', NOT_CONFIGURED: 'NOT_CONFIGURED', DISABLED: 'DISABLED' };
export const isMonitoredApi = (a) => a.status === API_STATUS.UP || a.status === API_STATUS.DOWN;

/** 외부 API 응답 시간 → { text, ms } ("123ms" 가 uptime 필드로 들어옴) */
export function apiResponse(api) {
    const ms = parseInt(api.uptime, 10);
    if (!ms) return { text: '—', ms: null };
    return { text: ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`, ms };
}

/**
 * 맨 위 "주의 필요" 목록 — tag: 중단(서비스·API 응답 없음) / 주의(불안정·사용률 높음) / 오류(5xx 응답)
 * @returns {{level, tag, title, detail}[]}
 */
export function buildIssues(rows, externalApis = [], recentErrorCount = 0) {
    const issues = [];
    rows.forEach((r) => {
        if (r.status === 'DOWN') {
            issues.push({ level: LEVEL.DOWN, tag: '중단', title: `${r.label} 응답 없음`, detail: r.orig });
        } else if (r.status === 'DEGRADED') {
            issues.push({ level: LEVEL.WARN, tag: '주의', title: `${r.label} 상태 불안정`, detail: r.orig });
        }
        [[r.isGpu ? '사용률' : 'CPU', r.cpu], [r.isGpu ? 'VRAM' : '메모리', r.mem]].forEach(([name, u]) => {
            if (u?.pct != null && u.pct >= WARN_PCT) {
                issues.push({ level: usageLevel(u.pct), tag: '주의', title: `${r.label} ${name} ${u.pct.toFixed(0)}%`, detail: u.text });
            }
        });
    });
    externalApis.forEach((a) => {
        if (a.status === API_STATUS.DOWN) {
            issues.push({ level: LEVEL.DOWN, tag: '중단', title: `외부 API ${a.name} 응답 없음`, detail: '' });
        }
    });
    if (recentErrorCount > 0) {
        issues.push({ level: LEVEL.DOWN, tag: '오류', title: `5xx 응답 ${recentErrorCount}건`, detail: '최근 5분' });
    }
    // 중단 → 오류 → 주의, 같은 꼬리표 안에서는 심한 것부터
    return issues.sort((a, b) => ISSUE_TAG_ORDER[a.tag] - ISSUE_TAG_ORDER[b.tag] || LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

/** 최근 구간의 5xx 응답 수 */
export function countRecentErrors(apiLogs, now) {
    return apiLogs.filter((l) => l.status >= 500 && now - new Date(l.timestamp).getTime() <= ERROR_WINDOW_MS).length;
}

/** "N초 전" / "N분 전" */
export function formatAgo(ts, now) {
    if (!ts) return '—';
    const sec = Math.max(0, Math.round((now - ts) / 1000));
    return sec < 60 ? `${sec}초 전` : `${Math.floor(sec / 60)}분 전`;
}
