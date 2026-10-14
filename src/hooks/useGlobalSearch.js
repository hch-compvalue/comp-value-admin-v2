import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { hasAnyRole } from '@/util/RoleUtil';
import routes from '@/config/routes';
import { SECTIONS } from '@/component/layouts/common/SideBar001';

const SCORE_LABEL_START = 3;
const SCORE_LABEL_INCLUDES = 2;
const SCORE_SECTION_INCLUDES = 1;

function scoreItem(item, q) {
    const label = item.label.toLowerCase();
    const section = item.section.toLowerCase();
    if (label.startsWith(q)) return SCORE_LABEL_START;
    if (label.includes(q)) return SCORE_LABEL_INCLUDES;
    if (section.includes(q)) return SCORE_SECTION_INCLUDES;
    return 0;
}

export function useGlobalSearch(query) {
    const { roles: userRoles } = useAuth();

    const items = useMemo(() => {
        return Object.entries(routes)
            .filter(([, r]) => r.show !== false && SECTIONS.includes(r.section))
            .filter(([, r]) => {
                // 사이드바와 같은 기준 — 접근 권한(accessRoles)이 없는 페이지는 검색 결과에서도 제외
                const roles = r.accessRoles || r.requiredRoles;
                if (roles && roles.length > 0) {
                    return hasAnyRole(userRoles, roles);
                }
                return true;
            })
            .map(([key, r]) => ({
                key,
                label: r.label,
                path: r.path,
                section: r.section,
            }));
    }, [userRoles]);

    const results = useMemo(() => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return items;

        return items
            .map(item => ({ ...item, _score: scoreItem(item, q) }))
            .filter(item => item._score > 0)
            .sort((a, b) => b._score - a._score);
    }, [items, query]);

    return { results };
}
