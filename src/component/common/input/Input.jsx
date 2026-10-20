/**
 * Input 컴포넌트
 *
 * 사용자의 텍스트 입력을 위한 공통 인풋 필드입니다.
 *
 * @param {Object} props - 컴포넌트 속성
 * @param {string} props.id - input 요소의 고유 ID
 * @param {string} [props.label] - input 상단에 표시할 라벨 텍스트
 * @param {boolean} [props.labelNewLine=false] - 라벨 줄바꿈 여부
 * @param {string} [props.placeholder] - 입력창에 표시될 placeholder
 * @param {string} [props.className] - 커스텀 스타일 클래스
 * @param {string} [props.value=""] - 입력값
 * @param {function} [props.onChange] - 값 변경 시 호출되는 콜백
 * @param {function} [props.onEnter] - Enter 입력 시 호출되는 콜백
 * @param {boolean} [props.disabled=false] - 비활성화 여부
 * @param {boolean} [props.wdfull=false] - 가로 너비 100% 설정 여부
 * @param {string|null} [props.inputMode=null] - 입력 모드 (예: "numeric", "text")
 *
 * @returns {JSX.Element} 렌더링된 input 필드
 *
 * @example
 * <Input
 *   id="username"
 *   label="사용자 이름"
 *   placeholder="이름을 입력하세요"
 *   type="text"
 *   value={username}
 *   onChange={(e) => setUsername(e.target.value)}
 *   onEnter={() => handleSubmit()}
 * />
 */
function Input({
    id,
    label = '',
    labelNewLine = false,
    placeholder = '',
    className = '',
    type = 'text',
    value = '',
    onChange = () => { },
    onEnter,
    disabled = false,
    wdfull = false,
    inputMode = null,
    inputRef = null
}) {
    const baseClassName = 'h-10 md:h-10 py-2 border border-slate-300 rounded-md shadow-sm px-3 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400';

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // 필요시 폼 제출 방지
            onEnter?.();        // onEnter 함수가 전달된 경우 실행
        }
    };

    return (
        <>
            {label && (
                <label
                    htmlFor={id}
                    className={`${labelNewLine ? 'block' : 'mr-2'} mb-1 text-sm text-slate-700 dark:text-slate-300`}
                >
                    {label}
                </label>
            )}
            <input
                ref={inputRef}
                id={id}
                placeholder={placeholder}
                className={`
          ${baseClassName}
          ${className}
          ${disabled ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-800 dark:text-slate-500' : ''}
          ${wdfull ? 'w-full' : ''}
        `}
                type={type}
                value={value}
                onKeyDown={handleKeyDown}
                onChange={onChange}
                disabled={disabled}
                {...(inputMode ? { inputMode } : {})}
            />
        </>
    );
}

export default Input;