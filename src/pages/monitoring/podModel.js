/**
 * 파드 탭 데이터 가공 — /monitoring/pods 응답(클러스터 전체 파드)을 상태·네임스페이스별로 정리
 */
import { LEVEL, WARN_PCT, formatMB } from './monitoringModel';

const PERCENT = 100;
const SEC_PER_MIN = 60;
const SEC_PER_HOUR = 3600;
const SEC_PER_DAY = 86400;
const SMALL_CORES = 0.01;

/** 네임스페이스 설명 (없으면 이름만) */
export const NAMESPACE_DESC = {
    default: '서비스',
    'kube-system': '쿠버네티스 시스템',
    argocd: '배포 (ArgoCD)',
    monitoring: '모니터링 (Prometheus·Grafana·Loki)',
    'ingress-nginx': '외부 접속 (Ingress)',
};
// 화면 표시 순서 (나머지는 이름순으로 뒤에)
const NAMESPACE_ORDER = ['default', 'monitoring', 'argocd', 'ingress-nginx', 'kube-system'];

// 대기 사유 → 한글 (문제 상태)
const WAITING_LABEL = {
    CrashLoopBackOff: '재시작 반복',
    ImagePullBackOff: '이미지 받기 실패',
    ErrImagePull: '이미지 받기 실패',
    CreateContainerConfigError: '설정 오류',
    CreateContainerError: '컨테이너 생성 실패',
    ContainerCreating: '생성 중',
    PodInitializing: '초기화 중',
};
// 정상 진행 과정인 대기 사유
const WAITING_PROGRESS = new Set(['ContainerCreating', 'PodInitializing']);

/** 직전 종료 사유 → 한글 (OOMKilled 만 문제로 강조 — 밤마다 PC 가 꺼져 Completed/Error 재시작은 흔함) */
export const TERMINATED_LABEL = {
    OOMKilled: '메모리 부족으로 종료',
    Error: '오류로 종료',
    Completed: '정상 종료',
    ContainerCannotRun: '실행 불가',
};

export const POD_STATE = {
    RUNNING: '실행 중',
    DONE: '완료',
};

/**
 * 파드 1개의 화면 상태
 * @returns {{level, label, done}} done = 완료된 Job (문제 아님, 숨김 대상)
 */
export function podState(p) {
    if (p.waitingReason) {
        return {
            level: WAITING_PROGRESS.has(p.waitingReason) ? LEVEL.WARN : LEVEL.DOWN,
            label: WAITING_LABEL[p.waitingReason] ?? p.waitingReason,
            done: false,
        };
    }
    if (p.phase === 'Failed') return { level: LEVEL.DOWN, label: '실패', done: false };
    if (p.phase === 'Pending') return { level: LEVEL.WARN, label: '대기 중', done: false };
    if (p.phase === 'Succeeded') return { level: LEVEL.UNKNOWN, label: POD_STATE.DONE, done: true };
    if (p.phase === 'Running') {
        if (p.totalContainers > 0 && p.readyContainers < p.totalContainers) return { level: LEVEL.WARN, label: '준비 안 됨', done: false };
        if (p.lastTerminatedReason === 'OOMKilled') return { level: LEVEL.WARN, label: POD_STATE.RUNNING, done: false };
        return { level: LEVEL.OK, label: POD_STATE.RUNNING, done: false };
    }
    return { level: LEVEL.UNKNOWN, label: p.phase || '알 수 없음', done: false };
}

/** 생성 후 경과 시간 → "3일" / "5시간" / "12분" */
export function formatAge(createdAtSec, nowMs) {
    if (!createdAtSec) return '—';
    const sec = Math.max(0, Math.floor(nowMs / 1000 - createdAtSec));
    if (sec >= SEC_PER_DAY) return `${Math.floor(sec / SEC_PER_DAY)}일`;
    if (sec >= SEC_PER_HOUR) return `${Math.floor(sec / SEC_PER_HOUR)}시간`;
    return `${Math.max(1, Math.floor(sec / SEC_PER_MIN))}분`;
}

/** 이미지 → 짧은 표시 ("ghcr.io/org/comp-value-service:sha-6f28973" → "comp-value-service:sha-6f28973") */
export function shortImage(image) {
    if (!image) return '';
    const slash = image.lastIndexOf('/');
    return slash >= 0 ? image.slice(slash + 1) : image;
}

const formatCores = (c) => (c > 0 && c < SMALL_CORES ? '<0.01' : c.toFixed(2));

/** CPU 사용 → { pct, text } (한도 없으면 pct null) */
export function podCpu(p) {
    if (p.cpuLimitCores > 0) {
        return { pct: Math.min((p.cpuCores / p.cpuLimitCores) * PERCENT, PERCENT), text: `${formatCores(p.cpuCores)} / ${p.cpuLimitCores} 코어` };
    }
    return { pct: null, text: `${formatCores(p.cpuCores)} 코어 · 한도 없음` };
}

export function podMem(p) {
    if (p.memoryLimitMB > 0) {
        return { pct: Math.min((p.memoryMB / p.memoryLimitMB) * PERCENT, PERCENT), text: `${formatMB(p.memoryMB)} / ${formatMB(p.memoryLimitMB)}` };
    }
    return { pct: null, text: `${formatMB(p.memoryMB)} · 한도 없음` };
}

const LEVEL_RANK = { [LEVEL.DOWN]: 0, [LEVEL.WARN]: 1, [LEVEL.OK]: 2, [LEVEL.UNKNOWN]: 3 };

// 실행 중 파드 중 이 비율 이상이 최근 1시간에 함께 재시작했으면 서버(PC) 재부팅으로 봄
const MASS_RESTART_RATIO = 0.8;
const MASS_RESTART_MIN_PODS = 3;

/** 최근 1시간에 대부분의 파드가 같이 재시작했는지 (서버 재부팅) — 이때는 파드별 경고 대신 안내 한 줄 */
export function isMassRestart(pods) {
    const running = pods.filter((p) => p.phase === 'Running');
    const recent = running.filter((p) => p.restartsLastHour > 0);
    return recent.length >= MASS_RESTART_MIN_PODS && recent.length / running.length >= MASS_RESTART_RATIO;
}

/** 화면용 파드 행 (상태·사용률·최근 재시작 반영) */
export function toPodRows(pods) {
    const massRestart = isMassRestart(pods);
    return pods.map((p) => {
        const state = podState(p);
        const cpu = podCpu(p);
        const mem = podMem(p);
        // 실행 중인데 사용률이 높거나 최근 1시간에 재시작했으면 주의 (서버 재부팅으로 다 같이 재시작한 경우 제외)
        const hot = [cpu.pct, mem.pct].some((v) => v != null && v >= WARN_PCT);
        const recentRestart = p.restartsLastHour > 0 && !massRestart;
        const level = state.level === LEVEL.OK && (hot || recentRestart) ? LEVEL.WARN : state.level;
        return { ...p, key: `${p.namespace}/${p.name}`, state: { ...state, level }, cpu, mem, recentRestart };
    });
}

/** 네임스페이스별 묶음 (정해진 순서, 그룹 안에서는 문제 파드가 위로) */
export function groupByNamespace(rows) {
    const map = new Map();
    rows.forEach((r) => {
        if (!map.has(r.namespace)) map.set(r.namespace, []);
        map.get(r.namespace).push(r);
    });
    const rank = (ns) => {
        const i = NAMESPACE_ORDER.indexOf(ns);
        return i === -1 ? NAMESPACE_ORDER.length : i;
    };
    return [...map.entries()]
        .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
        .map(([namespace, list]) => ({
            namespace,
            pods: [...list].sort((a, b) => LEVEL_RANK[a.state.level] - LEVEL_RANK[b.state.level] || a.name.localeCompare(b.name)),
            problems: list.filter((r) => r.state.level === LEVEL.DOWN || r.state.level === LEVEL.WARN).length,
        }));
}

// ── 구성도 ──

/** 앱(배포 단위) 이름 → 역할 (구성도 표시용) */
export const APP_LABEL = {
    'comp-value-web': '웹 화면',
    'comp-value-service': '백엔드 API',
    'trader-api': '자동매매',
    postgres: '데이터베이스',
    redis: '캐시',
    'postgres-backup': 'DB 백업 (매일)',
    'ingress-nginx-controller': '외부 접속 관문',
    'ingress-nginx-admission-create': '설치 작업',
    'ingress-nginx-admission-patch': '설치 작업',
    prometheus: '지표 수집·저장',
    grafana: '대시보드',
    loki: '로그 저장',
    promtail: '로그 수집',
    'kube-state-metrics': '쿠버네티스 상태 지표',
    'dcgm-exporter': 'GPU 지표',
    'argocd-server': 'ArgoCD 화면·API',
    'argocd-repo-server': 'Git 저장소 읽기',
    'argocd-application-controller': '배포 동기화',
    'argocd-dex-server': '로그인 연동',
    'argocd-redis': 'ArgoCD 캐시',
    'argocd-notifications-controller': '알림',
    coredns: '내부 DNS',
    etcd: '클러스터 저장소',
    'kube-apiserver': '쿠버네티스 API',
    'kube-controller-manager': '컨트롤러',
    'kube-scheduler': '파드 배치',
    'kube-proxy': '네트워크 프록시',
    'metrics-server': '리소스 지표',
    'nvidia-device-plugin-daemonset': 'GPU 연결',
    'storage-provisioner': '디스크 할당',
};

/** 사용자 요청이 지나가는 길 (구성도 맨 위 흐름) — 마지막 칸은 백엔드가 쓰는 것들 */
export const REQUEST_FLOW = [['ingress-nginx-controller'], ['comp-value-web'], ['comp-value-service'], ['postgres', 'redis', 'trader-api']];

const REPLICASET_HASH = /-[a-z0-9]{6,10}$/;
const CRONJOB_SUFFIX = /-\d{6,}$/;

/** 파드 → 앱(배포 단위) 이름 */
export function appName(p) {
    const owner = p.ownerName;
    switch (p.ownerKind) {
        case 'ReplicaSet': return owner.replace(REPLICASET_HASH, '');
        case 'Job': return owner.replace(CRONJOB_SUFFIX, '');
        case 'StatefulSet':
        case 'DaemonSet': return owner;
        case 'Node': return p.node && p.name.endsWith(`-${p.node}`) ? p.name.slice(0, -(p.node.length + 1)) : p.name;
        default: return p.name;
    }
}

const worstLevel = (levels) => levels.reduce((worst, l) => (LEVEL_RANK[l] < LEVEL_RANK[worst] ? l : worst), LEVEL.UNKNOWN);

/**
 * 구성도 데이터 — 네임스페이스 → 앱 묶음
 * @returns {{namespace, desc, apps: {key, app, label, kind, podCount, doneCount, level, allDone, memoryMB}[]}[]}
 */
export function buildPodMap(rows) {
    return groupByNamespace(rows).map((g) => {
        const apps = new Map();
        g.pods.forEach((r) => {
            const app = appName(r);
            if (!apps.has(app)) apps.set(app, []);
            apps.get(app).push(r);
        });
        const list = [...apps.entries()].map(([app, pods]) => {
            const active = pods.filter((p) => !p.state.done);
            return {
                key: `${g.namespace}/${app}`,
                app,
                label: APP_LABEL[app] ?? null,
                kind: pods[0].ownerKind,
                podCount: pods.length,
                doneCount: pods.length - active.length,
                allDone: active.length === 0,
                level: active.length ? worstLevel(active.map((p) => p.state.level)) : LEVEL.UNKNOWN,
                memoryMB: active.reduce((sum, p) => sum + (p.memoryMB || 0), 0),
            };
        });
        // 문제 → 실행 중 → 완료 작업 순, 같은 단계는 이름순
        list.sort((a, b) => Number(a.allDone) - Number(b.allDone) || LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.app.localeCompare(b.app));
        return { namespace: g.namespace, desc: NAMESPACE_DESC[g.namespace] ?? '', apps: list };
    });
}
