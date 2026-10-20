import { Td } from './TableCells';

/**
 * 신규 거래 입력 행
 */
export function NewTransactionRow({ newRow, setNewRow, onAdd, saving }) {
    return (
        <tr className="bg-slate-50/60 dark:bg-slate-800/60">
            <Td className="sticky left-0 z-10 bg-slate-50/60 dark:bg-slate-800/60" />
            <Td className="sticky left-12 z-10 bg-slate-50/60 dark:bg-slate-800/60">
                <input
                    value={newRow.symbol}
                    onChange={(e) => setNewRow((p) => ({ ...p, symbol: e.target.value }))}
                    className="w-full h-9 rounded border px-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    placeholder="티커"
                />
            </Td>
            <Td>
                <input
                    value={newRow.companyName}
                    onChange={(e) => setNewRow((p) => ({ ...p, companyName: e.target.value }))}
                    className="w-full h-9 rounded border px-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    placeholder="기업명"
                />
            </Td>
            <Td>
                <input
                    value={newRow.buyDate}
                    onChange={(e) => setNewRow((p) => ({ ...p, buyDate: e.target.value }))}
                    className="w-full h-9 rounded border px-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    type="date"
                />
            </Td>
            <Td>
                <input
                    value={newRow.buyPrice}
                    onChange={(e) => setNewRow((p) => ({ ...p, buyPrice: e.target.value }))}
                    className="w-full h-9 rounded border px-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    placeholder="매수가"
                    type="number"
                />
            </Td>
            <Td />
            <Td>
                <input
                    value={newRow.totalBuyAmount}
                    onChange={(e) => setNewRow((p) => ({ ...p, totalBuyAmount: e.target.value }))}
                    className="w-full h-9 rounded border px-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    placeholder="수량"
                    type="number"
                />
            </Td>
            <Td />
            <Td />
            <Td />
            <Td>
                <input
                    value={newRow.targetPrice}
                    onChange={(e) => setNewRow((p) => ({ ...p, targetPrice: e.target.value }))}
                    className="w-full h-9 rounded border px-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    placeholder="목표가"
                    type="number"
                />
            </Td>
            <Td />
            <Td />
            <Td>
                <input
                    value={newRow.rmk}
                    onChange={(e) => setNewRow((p) => ({ ...p, rmk: e.target.value }))}
                    className="w-full h-9 rounded border px-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                    placeholder="비고"
                />
            </Td>
            <Td>
                <button
                    onClick={onAdd}
                    className="px-2.5 py-1 rounded-md border text-xs hover:bg-blue-50 hover:border-blue-300 cursor-pointer disabled:cursor-not-allowed dark:border-slate-600 dark:text-slate-300 dark:hover:bg-blue-900/30 dark:hover:border-blue-700"
                    disabled={saving}
                >
                    등록
                </button>
            </Td>
        </tr>
    );
}
