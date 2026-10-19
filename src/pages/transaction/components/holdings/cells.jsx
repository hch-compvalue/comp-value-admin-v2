import { fmtDate } from '../../utils/formatters';
import { Money, SymbolCell, CurPriceCell, EvalAmountCell, PnlCell } from './parts';

/**
 * 컬럼 key → 셀 렌더러 (constants TABLE_COLUMNS 의 key 와 1:1)
 * @param m   표시 모델 (utils/holdingModel.js)
 * @param ctx { currency, fx, expandedSymbols, onToggleGroup }
 */
export const CELL_RENDERERS = {
    symbol: (m, ctx) => <SymbolCell m={m} ctx={ctx} />,
    qty: (m) => (m.qty ? m.qty.toLocaleString() : ''),
    buyPrice: (m, ctx) => (m.buyPrice ? <Money usd={m.buyPrice} ctx={ctx} /> : ''),
    curPrice: (m, ctx) => <CurPriceCell m={m} ctx={ctx} />,
    evalAmount: (m, ctx) => <EvalAmountCell m={m} ctx={ctx} />,
    pnl: (m, ctx) => <PnlCell m={m} ctx={ctx} />,
    buyDate: (m) => <span className="text-slate-500 dark:text-slate-400">{fmtDate(m.buyDate)}</span>,
    rmk: (m) => (
        <div className="truncate text-xs text-slate-500 dark:text-slate-400" title={m.rmk || ''}>{m.rmk || ''}</div>
    ),
};
