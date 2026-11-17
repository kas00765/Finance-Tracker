import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { formatMoney } from '../utils/currency.js';

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  color: 'var(--text)',
};
const axis = {
  tick: { fill: 'var(--text-muted)', fontSize: 11 },
  axisLine: false,
  tickLine: false,
};

export function CashflowChart({ data, currency }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Monthly income and expenses. Totals are shown in the summary cards."
    >
      <ResponsiveContainer width="100%" height={245}>
        <BarChart data={data} barGap={6} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" {...axis} />
          <YAxis
            {...axis}
            tickFormatter={(value) =>
              new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value)
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'var(--accent-soft)' }}
            formatter={(value) => formatMoney(value, currency)}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill="#34c69a"
            radius={[5, 5, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            dataKey="expense"
            name="Expenses"
            fill="#8194f6"
            radius={[5, 5, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceChart({ data, currency }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Cumulative net cash flow for the selected transactions."
    >
      <ResponsiveContainer width="100%" height={275}>
        <AreaChart data={data} margin={{ top: 16, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34c69a" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#34c69a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" {...axis} tickFormatter={(date) => date.slice(5)} minTickGap={25} />
          <YAxis
            {...axis}
            tickFormatter={(value) =>
              new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value)
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => formatMoney(value, currency)}
          />
          <Area
            type="linear"
            dataKey="balance"
            name="Net cash flow"
            stroke="#34c69a"
            strokeWidth={2}
            fill="url(#balance-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
