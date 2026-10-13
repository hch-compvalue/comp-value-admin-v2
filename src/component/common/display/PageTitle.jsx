import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import routes from '@/config/routes';
import { EmbeddedPageContext } from '@/context/EmbeddedPageContext';

/**
 * 페이지 타이틀 및 브레드크럼 컴포넌트
 * 현재 경로를 기반으로 routes에서 섹션과 라벨을 찾아 자동으로 표시합니다.
 *
 * @component
 * @returns {JSX.Element} 페이지 타이틀과 브레드크럼
 *
 * @example
 * <PageTitle />
 */
function PageTitle() {
    const location = useLocation();
    // 하위 탭으로 삽입된 페이지면 탭 정보를 우선 사용
    const embedded = useContext(EmbeddedPageContext);

    // 현재 경로와 일치하는 라우트 찾기
    const findRoute = () => {
        // 먼저 정확히 일치하는 경로 찾기
        for (const [key, route] of Object.entries(routes)) {
            if (route.path === location.pathname) {
                return route;
            }
        }

        // 동적 경로 또는 자식 경로 찾기
        for (const [key, route] of Object.entries(routes)) {
            if (route.children) {
                for (const child of route.children) {
                    const fullPath = route.path + child.path;
                    // 동적 파라미터를 포함한 경로 매칭
                    const pathPattern = fullPath.replace(/:\w+/g, '[^/]+');
                    const regex = new RegExp(`^${pathPattern}$`);
                    if (regex.test(location.pathname)) {
                        return { ...child, parentLabel: route.label };
                    }
                }
            }
        }

        return null;
    };

    const currentRoute = embedded ?? findRoute();

    if (!currentRoute) {
        return null;
    }

    return (
        <div className="mb-6">
            {/* 브레드크럼 */}
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>{currentRoute.section}</span>
                {currentRoute.parentLabel && (
                    <>
                        <span>{'>'}</span>
                        <span>{currentRoute.parentLabel}</span>
                    </>
                )}
                <span>{'>'}</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">{currentRoute.label}</span>
            </div>

            {/* 페이지 타이틀 */}
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
                {currentRoute.label}
            </h1>
        </div>
    );
}

export default PageTitle;
