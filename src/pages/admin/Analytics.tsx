import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../i18n'
import { store } from '../../lib/store'
import { symptomById } from '../../lib/triage'
import { Card, SectionTitle, EmptyState, Spinner, Notice } from '../../components/ui'
import { BarChart, DonutChart } from '../../components/charts'
import { IconPin } from '../../components/icons'
import type { Triage, Band } from '../../lib/types'

const BAND_COLORS: Record<Band, string> = { NOR: '#15803d', MOD: '#d97706', EMR: '#dc2626' }
const SYM_COLORS = ['#0b64b4', '#15803d', '#b45309', '#0e7490', '#6d28d9', '#be123c', '#4d7c0f', '#a16207']

export default function Analytics() {
  const { t } = useLang()
  const [triages, setTriages] = useState<(Triage & { id: string })[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const since = Date.now() - 7 * 86400000
    return store().col<Triage>('triages').subscribe(
      docs => { setTriages(docs); setLoaded(true) },
      tr => tr.createdAt >= since,
      [{ field: 'createdAt', op: '>=', value: since }],
    )
  }, [])

  const m = useMemo(() => {
    // area × symptom clustering
    const cell = new Map<string, number>()
    const symTotal = new Map<string, number>()
    const bandCount: Record<Band, number> = { NOR: 0, MOD: 0, EMR: 0 }
    triages.forEach(tr => {
      bandCount[tr.band]++
      const area = (tr.village || '').trim() || 'Unknown'
      const syms = [...new Set([...(tr.symptoms || []), ...(tr.extractedSymptoms || [])])]
      if (syms.length === 0) {
        const k = `${area}|||` + 'unspecified'
        cell.set(k, (cell.get(k) || 0) + 1)
        symTotal.set('unspecified', (symTotal.get('unspecified') || 0) + 1)
      }
      syms.forEach(s => {
        const k = `${area}|||${s}`
        cell.set(k, (cell.get(k) || 0) + 1)
        symTotal.set(s, (symTotal.get(s) || 0) + 1)
      })
    })
    const rows = [...cell.entries()]
      .map(([k, count]) => { const [area, sym] = k.split('|||'); return { area, sym, count } })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
    const topSymptoms = [...symTotal.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([s, value], i) => ({
        label: s === 'unspecified' ? '—' : (symptomById(s)?.en || s),
        value, color: SYM_COLORS[i % SYM_COLORS.length],
      }))
    const bands = (['NOR', 'MOD', 'EMR'] as Band[]).map(b => ({
      label: b, value: bandCount[b], color: BAND_COLORS[b],
    }))
    return { rows, topSymptoms, bands, total: triages.length }
  }, [triages])

  const symName = (s: string) => s === 'unspecified' ? '—' : (symptomById(s)?.en || s)

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>{t.admin.outbreak}</SectionTitle>
        <Notice>{t.admin.outbreakHint} · {t.admin.last7d} · {m.total} assessments</Notice>
      </div>

      <Card className="p-4">
        <SectionTitle>{t.admin.byBand}</SectionTitle>
        {m.total === 0 ? <EmptyState title={t.doctor.empty} /> : <DonutChart data={m.bands} />}
      </Card>

      <Card className="p-4">
        <SectionTitle>{t.admin.symptom} · {t.admin.last7d}</SectionTitle>
        {m.topSymptoms.length === 0
          ? <EmptyState title={t.doctor.empty} />
          : <BarChart data={m.topSymptoms} />}
      </Card>

      <div>
        <SectionTitle>{t.admin.area} × {t.admin.symptom}</SectionTitle>
        {m.rows.length === 0 ? (
          <Card><EmptyState icon={<IconPin size={22} />} title={t.doctor.empty} /></Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-ink-400 border-b border-slate-100">
                  <th className="font-medium px-4 py-2.5">{t.admin.area}</th>
                  <th className="font-medium px-4 py-2.5">{t.admin.symptom}</th>
                  <th className="font-medium px-4 py-2.5 text-right">{t.admin.count}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {m.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-medium text-ink-900">{r.area}</td>
                    <td className="px-4 py-2.5 text-ink-700">{symName(r.sym)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`inline-flex min-w-[28px] justify-center rounded-full px-2 py-0.5 text-[12px] font-bold ${r.count >= 3 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-ink-700'}`}>
                        {r.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        <p className="text-[12px] text-ink-400 mt-2">
          Clusters of 3+ reports are highlighted — consider outreach or camp screening in those areas.
        </p>
      </div>
    </div>
  )
}
