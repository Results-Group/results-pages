'use client'

/**
 * The one place recharts is imported. Extracted from report-presentation.tsx
 * (verbatim) and loaded via next/dynamic so a report with zero chart blocks
 * never ships the heaviest client dependency on the page.
 */
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import type { ReportBlock } from '@/lib/performance-reports'

const CHART_COLORS = ['#FFDC71', '#00E5FF', '#1877F2', '#a78bfa', '#4ade80', '#f87171', '#fb923c']

export default function Chart({ block }: { block: ReportBlock }) {
  const labels = block.labels || []
  const datasets = block.datasets || []
  if (!labels.length || !datasets.length) return null

  if (block.chartType === 'doughnut') {
    const pieData = labels.map((label, i) => ({ name: label, value: datasets[0]?.data[i] || 0 }))
    return (
      <div className="rpt-chart-container">
        {block.title && <div className="rpt-chart-title">{block.title}</div>}
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie isAnimationActive={false} data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110}>
              {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
            <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const chartData = labels.map((label, i) => {
    const point: Record<string, unknown> = { name: label }
    datasets.forEach(ds => { point[ds.label] = ds.data[i] || 0 })
    return point
  })

  const ChartComponent = block.chartType === 'bar' ? BarChart : LineChart

  return (
    <div className="rpt-chart-container">
      {block.title && <div className="rpt-chart-title">{block.title}</div>}
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} />
          <YAxis tick={{ fill: '#aaa', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
          <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
          {datasets.map((ds, i) => (
            block.chartType === 'bar'
              ? <Bar isAnimationActive={false} key={ds.label} dataKey={ds.label} fill={ds.color || CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
              : <Line isAnimationActive={false} key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color || CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}
