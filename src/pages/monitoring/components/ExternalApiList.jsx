import { LEVEL, EXTERNAL_API_DESC, API_SLOW_MS, API_VERY_SLOW_MS, apiResponse } from '../monitoringModel';
import { Panel, StatusDot } from './MonitoringUi';
import { LEVEL_TEXT } from './levelStyles';

const speedLevel = (ms) => (ms == null ? LEVEL.UNKNOWN : ms < API_SLOW_MS ? LEVEL.OK : ms < API_VERY_SLOW_MS ? LEVEL.WARN : LEVEL.DOWN);

/** 외부 API 상태 — 서버가 주기적으로 확인한 응답 여부와 응답 시간 */
export default function ExternalApiList({ id, apis = [] }) {
    return (
        <Panel id={id} title="외부 API" subtitle="응답 시간" bodyClassName="">
            {apis.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">외부 API 상태를 확인하는 중입니다.</div>
            ) : (
                <ul>
                    {apis.map((api) => {
                        const up = api.status === 'UP';
                        const res = apiResponse(api);
                        return (
                            <li key={api.name} className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm first:border-t-0 dark:border-slate-700/60">
                                <StatusDot level={up ? LEVEL.OK : LEVEL.DOWN} />
                                <span className="min-w-0 flex-1">
                                    <span className="font-semibold text-slate-900 dark:text-white">{api.name}</span>
                                    {EXTERNAL_API_DESC[api.name] && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{EXTERNAL_API_DESC[api.name]}</span>}
                                    {api.version === 'No API Key' && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">API 키 미설정</span>}
                                </span>
                                {up ? (
                                    <span className={`font-semibold ${LEVEL_TEXT[speedLevel(res.ms)]}`}>{res.text}</span>
                                ) : (
                                    <span className={`font-semibold ${LEVEL_TEXT[LEVEL.DOWN]}`}>응답 없음</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}
