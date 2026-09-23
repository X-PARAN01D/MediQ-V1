/* Hand-rolled SVG charts — no chart library, keeps the bundle small. */

export function BarChart({ data, height = 160, color = '#0b64b4' }: {
  data: { label: string; value: number; color?: string }[]; height?: number; color?: string
}) {
  const max = Math.max(1, ...data.map(d => d.value))
  const w = 320, pad = 8
  const bw = Math.min(44, (w - pad * 2) / data.length - 10)
  return (
    <svg viewBox={`0 0 ${w} ${height + 28}`} className="w-full" role="img">
      {data.map((d, i) => {
        const h = Math.max(3, (d.value / max) * height)
        const x = pad + i * ((w - pad * 2) / data.length) + ((w - pad * 2) / data.length - bw) / 2
        return (
          <g key={i}>
            <rect x={x} y={height - h} width={bw} height={h} rx={5} fill={d.color || color} opacity={0.92} />
            <text x={x + bw / 2} y={height - h - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="#2c425f">{d.value}</text>
            <text x={x + bw / 2} y={height + 16} textAnchor="middle" fontSize={10.5} fill="#5b7189">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function DonutChart({ data, size = 150 }: {
  data: { label: string; value: number; color: string }[]; size?: number
}) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0))
  const r = 60, cx = 75, cy = 75, sw = 22
  let acc = 0
  const segs = data.map(d => {
    const frac = d.value / total
    const start = acc; acc += frac
    return { ...d, start, frac }
  })
  const arc = (s: number, f: number) => {
    const a0 = s * Math.PI * 2 - Math.PI / 2, a1 = (s + f) * Math.PI * 2 - Math.PI / 2
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    return `M ${x0} ${y0} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x1} ${y1}`
  }
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 150 150" role="img">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#edf2f7" strokeWidth={sw} />
        {segs.map((s, i) => s.frac > 0 && (
          <path key={i} d={arc(s.start, Math.max(0.001, s.frac))} fill="none"
            stroke={s.color} strokeWidth={sw} strokeLinecap="butt" />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={20} fontWeight={700} fill="#0f2440">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={10.5} fill="#5b7189">total</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-[13px]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-ink-700">{d.label}</span>
            <span className="font-semibold text-ink-900 ml-auto pl-3">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Sparkline({ data, width = 220, height = 48, color = '#0b64b4' }: {
  data: number[]; width?: number; height?: number; color?: string
}) {
  if (data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data), rng = Math.max(1, max - min)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 8) + 4
    const y = height - 6 - ((v - min) / rng) * (height - 14)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible" role="img">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * (width - 8) + 4
        const y = height - 6 - ((v - min) / rng) * (height - 14)
        return i === data.length - 1
          ? <circle key={i} cx={x} cy={y} r={3.4} fill={color} stroke="#fff" strokeWidth={1.5} />
          : null
      })}
    </svg>
  )
}
