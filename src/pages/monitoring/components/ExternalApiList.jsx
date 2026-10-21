import { useEffect, useState } from 'react';
import { send } from '@/util/ClientUtil';
import { LEVEL, API_STATUS, EXTERNAL_API_DESC, API_SLOW_MS, API_VERY_SLOW_MS, apiResponse } from '../monitoringModel';
import { Panel, StatusDot } from './MonitoringUi';
import { LEVEL_TEXT } from './levelStyles';

const TOGGLE_API = (name) => `/dart/monitoring/external-apis/${encodeURIComponent(name)}`;

const speedLevel = (ms) => (ms == null ? LEVEL.UNKNOWN : ms < API_SLOW_MS ? LEVEL.OK : ms < API_VERY_SLOW_MS ? LEVEL.WARN : LEVEL.DOWN);

/** 상태 → 점 단계·오른쪽 표시 */
function apiView(api) {
    switch (api.status) {
        case API_STATUS.UP: {
            const res = apiResponse(api);
            return { level: LEVEL.OK, text: res.text, textClass: LEVEL_TEXT[speedLevel(res.ms)] };
        }
        case API_STATUS.NOT_CONFIGURED:
            return { level: LEVEL.UNKNOWN, text: 'API 키 미설정', textClass: 'text-slate-500 dark:text-slate-400' };
        case API_STATUS.DISABLED:
            return { level: LEVEL.UNKNOWN, text: '사용 안 함', textClass: 'text-slate-500 dark:text-slate-400' };
        default:
            return { level: LEVEL.DOWN, text: '응답 없음', textClass: LEVEL_TEXT[LEVEL.DOWN] };
    }
}

/**
 * 외부 API 상태 — 서버가 30초마다 확인한 응답 여부·응답 시간
 * - 오른쪽 스위치로 모니터링 확인을 끄고 켬 (끄면 서버가 확인 호출을 멈춤, 실제 기능의 호출은 그대로)
 */
export default function ExternalApiList({ id, apis = [] }) {
    // 스위치를 누른 뒤 실시간 snapshot 이 따라올 때까지 보여줄 상태 { saving } → { result }
    const [pending, setPending] = useState({});
    const [error, setError] = useState('');

    // snapshot 이 저장 결과와 같은 상태가 되면 임시 상태 제거
    useEffect(() => {
        setPending((prev) => {
            const done = apis.filter((a) => prev[a.name]?.result?.status === a.status).map((a) => a.name);
            if (done.length === 0) return prev;
            const next = { ...prev };
            done.forEach((name) => delete next[name]);
            return next;
        });
    }, [apis]);

    const clearPending = (name) => setPending((p) => {
        const next = { ...p };
        delete next[name];
        return next;
    });

    const toggle = async (api, enabled) => {
        setError('');
        setPending((p) => ({ ...p, [api.name]: { saving: true } }));
        const { data, error: err } = await send(TOGGLE_API(api.name), { enabled }, 'PUT');
        if (err || !data?.response) {
            setError(`${api.name} 설정을 바꾸지 못했습니다${err ? `: ${err}` : '.'}`);
            clearPending(api.name);
            return;
        }
        setPending((p) => ({ ...p, [api.name]: { result: data.response } }));
    };

    return (
        <Panel id={id} title="외부 API" subtitle="30초마다 확인 · 스위치로 확인 끄기" bodyClassName="">
            {error && <div role="alert" className="border-b border-orange-200 bg-orange-50 px-4 py-2 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300">{error}</div>}
            {apis.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">외부 API 상태를 확인하는 중입니다.</div>
            ) : (
                <ul>
                    {apis.map((raw) => {
                        const p = pending[raw.name];
                        const api = p?.result ?? raw;
                        const view = apiView(api);
                        const enabled = api.status !== API_STATUS.DISABLED;
                        const muted = api.status === API_STATUS.DISABLED || api.status === API_STATUS.NOT_CONFIGURED;
                        return (
                            <li key={raw.name} className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm first:border-t-0 dark:border-slate-700/60">
                                <StatusDot level={view.level} />
                                <span className={`min-w-0 flex-1 ${muted ? 'opacity-70' : ''}`}>
                                    <span className="font-semibold text-slate-900 dark:text-white">{raw.name}</span>
                                    {EXTERNAL_API_DESC[raw.name] && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{EXTERNAL_API_DESC[raw.name]}</span>}
                                </span>
                                <span className={`shrink-0 font-semibold ${view.textClass}`}>{p?.saving ? '변경 중…' : view.text}</span>
                                <Switch
                                    checked={enabled}
                                    disabled={!!p?.saving}
                                    label={`${raw.name} 모니터링 ${enabled ? '끄기' : '켜기'}`}
                                    onChange={() => toggle(raw, !enabled)}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

function Switch({ checked, disabled, label, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onChange}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                checked ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'
            }`}
        >
            <span aria-hidden="true" className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
    );
}
