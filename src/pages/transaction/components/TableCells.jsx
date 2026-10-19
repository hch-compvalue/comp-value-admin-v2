/**
 * 금액 표시 – 정수부분 진하게, 소수부분 연하게
 */
export function FmtAmount({ text }) {
    if (!text) return null;
    const dotIdx = text.indexOf('.');
    if (dotIdx === -1) return text;
    return (
        <>
            {text.substring(0, dotIdx)}
            <span className="font-normal opacity-50">{text.substring(dotIdx)}</span>
        </>
    );
}

/**
 * 기본 테이블 셀 컴포넌트
 */
export function Td({ children, className = '' }) {
    return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}
