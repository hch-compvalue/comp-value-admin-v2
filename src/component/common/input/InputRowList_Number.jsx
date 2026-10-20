import Input from '@/component/common/input/Input';

/**
 * 입력 행 리스트 컴포넌트
 * @param {Array} rows - [labelNode, value, setter] 형태의 배열
 */
const InputRowList = ({ rows }) => {
    return (
        <div className="space-y-4">
            {rows.map(([labelNode, value, setter], idx) => (
                <div key={idx} className="flex flex-col md:flex-row items-center gap-2">
                    <div className="w-full md:w-1/5 font-medium flex items-center text-slate-700 dark:text-slate-300">
                        {labelNode}
                    </div>
                    <div className="w-full md:w-2/5">
                        <Input
                            className="w-full"
                            inputMode="numeric"
                            value={value}
                            onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9.]/g, '');
                                const parts = raw.split('.');
                                const numeric =
                                    parts.length > 2
                                        ? parts[0] + '.' + parts.slice(1).join('')
                                        : raw;
                                setter(numeric);
                            }}
                        />
                    </div>
                    <div className="w-full md:w-2/5 text-right font-semibold truncate text-slate-600 dark:text-slate-300">
                        {Number(value).toLocaleString()}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default InputRowList;