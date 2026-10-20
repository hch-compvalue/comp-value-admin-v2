import { useState, useEffect } from 'react';


/**
 * 페이지네이션 컴포넌트
 *
 * @component
 * @param {Object} props - 컴포넌트 속성
 * @param {number} props.totalCount - 전체 항목 수
 * @param {number} [props.pageSize=10] - 페이지당 항목 수
 * @param {number} [props.pageBlock=3] - 한 번에 표시할 페이지 번호 수
 * @param {number} props.currentPage - 현재 페이지 번호
 * @param {function} props.onPageChange - 페이지 변경 시 호출되는 콜백 함수
 * @returns {JSX.Element|null} 페이지네이션 UI 요소
 *
 * @example
 * <PageNation
 *   totalCount={100}
 *   pageSize={10}
 *   pageBlock={5}
 *   currentPage={1}
 *   onPageChange={(page) => setCurrentPage(page)}
 * />
 */
function PageNation({ totalCount, pageSize = 10, pageBlock = 3, currentPage, onPageChange }) {

    const [totalPage, setTotalPage] = useState(0);
    const [startPage, setStartPage] = useState(0);
    const [endPage, setEndPage] = useState(0);

    useEffect(() => {

        const realTotalPage = Math.ceil(totalCount / pageSize);
        const realStartPage = Math.floor((currentPage - 1) / pageBlock) * pageBlock + 1;
        let realEndPage = realStartPage + pageBlock - 1;
        if (realEndPage > realTotalPage) realEndPage = realTotalPage;

        setTotalPage(realTotalPage);
        setStartPage(realStartPage);
        setEndPage(realEndPage);

    }, [totalCount, pageSize, pageBlock, currentPage]);

    if (totalPage === 0) return null; // 데이터 없으면 렌더링 안함

    const goStartPage = () => {
        onPageChange(1);
    };

    const goPrevBlock = () => {
        const prevPage = Math.max(startPage - 1, 1);
        onPageChange(prevPage);
    };

    const goNextBlock = () => {
        const nextPage = Math.min(endPage + 1, totalPage);
        onPageChange(nextPage);
    };

    const goEndPage = () => {
        onPageChange(totalPage);
    }

    return (
        <div className="flex justify-center items-center space-x-2 my-4">

            {/* << 버튼 */}
            {startPage > pageBlock && (
                <button onClick={goStartPage}>
                    ◀◀
                </button>
            )}

            {/* < 버튼 */}
            {startPage > 1 && (
                <button onClick={goPrevBlock} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    ◀
                </button>
            )}

            {/* 페이지 번호 버튼들 */}
            {Array.from({ length: endPage - startPage + 1 }, (_, idx) => {
                const page = startPage + idx;
                return (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`px-3 py-1 rounded border 
                            ${page === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'}
                        `}
                    >
                        {page}
                    </button>
                );
            })}

            {/* > 버튼 */}
            {endPage < totalPage && (
                <button onClick={goNextBlock} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    ▶
                </button>
            )}
            {/* >> 버튼 */}
            {endPage < totalPage && (
                <button onClick={goEndPage} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    ▶▶
                </button>
            )}
        </div>
    );
}

export default PageNation;