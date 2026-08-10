'use client'

import { Plus, X, Star } from 'lucide-react'
import {
  normalizeStats,
  newStatsKpi,
  newStatsGroup,
  newFunnelStage,
  newViewFunnel,
  type StatsBlock,
  type StatsKpi,
  type StatsFunnelStage,
} from '@/lib/launch-stats'
import { useT } from '@/lib/i18n'

const fieldStyle: React.CSSProperties = {
  background: 'var(--admin-hover-bg)',
  border: '1px solid var(--admin-border)',
  color: 'var(--admin-text-primary)',
  colorScheme: 'var(--color-scheme)',
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
      {children}
    </label>
  )
}

/**
 * Inspector panel for a 'stats' slide. Values are free text pasted from the ad
 * platforms — nothing is parsed or computed, so the slide shows exactly what
 * the operator typed (see lib/launch-stats.ts).
 */
export default function StatsFields({
  stats,
  onChange,
}: {
  stats?: StatsBlock | null
  onChange: (stats: StatsBlock) => void
}) {
  const t = useT()
  const b = normalizeStats(stats)

  const patch = (next: Partial<StatsBlock>) => onChange({ ...b, ...next })

  function kpiRow(
    k: StatsKpi,
    update: (patch: Partial<StatsKpi>) => void,
    remove: () => void,
  ) {
    return (
      <div key={k.id} className="rounded-lg p-2 space-y-1.5" style={{ background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}>
        <div className="flex items-center gap-1.5">
          <input
            type="text" value={k.label} dir="auto"
            placeholder={t('campaigns.stats.kpiLabel')}
            onChange={e => update({ label: e.target.value })}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md text-xs outline-none"
            style={fieldStyle}
          />
          <input
            type="text" value={k.value} dir="auto"
            placeholder={t('campaigns.stats.kpiValue')}
            onChange={e => update({ value: e.target.value })}
            className="w-24 px-2.5 py-1.5 rounded-md text-xs outline-none tabular-nums"
            style={fieldStyle}
          />
          <button
            type="button"
            onClick={() => update({ highlight: !k.highlight })}
            className="p-1.5 rounded-md shrink-0 transition-colors"
            style={k.highlight ? { color: '#40e1d3', background: 'rgba(64,225,211,0.12)' } : { color: 'var(--admin-text-muted)' }}
            aria-label={t('campaigns.stats.highlight')}
            title={t('campaigns.stats.highlight')}
          >
            <Star className="w-3.5 h-3.5" />
          </button>
          <button
            type="button" onClick={remove}
            className="p-1.5 rounded-md shrink-0" style={{ color: 'var(--admin-text-muted)' }}
            aria-label="מחיקה"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <input
          type="text" value={k.sublabel ?? ''} dir="auto"
          placeholder={t('campaigns.stats.kpiSublabel')}
          onChange={e => update({ sublabel: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-md text-[11px] outline-none"
          style={fieldStyle}
        />
      </div>
    )
  }

  function addButton(label: string, onClick: () => void) {
    return (
      <button
        type="button" onClick={onClick}
        className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
        style={{ color: 'var(--admin-text-secondary)', background: 'var(--admin-hover-bg)', border: '1px solid var(--admin-border)' }}
      >
        <Plus className="w-3.5 h-3.5" /> {label}
      </button>
    )
  }

  return (
    <div className="space-y-5">
      {/* Top KPI grid */}
      <div>
        <Label>{t('campaigns.stats.kpisSection')}</Label>
        <div className="space-y-1.5">
          {b.kpis.map(k =>
            kpiRow(
              k,
              p => patch({ kpis: b.kpis.map(x => (x.id === k.id ? { ...x, ...p } : x)) }),
              () => patch({ kpis: b.kpis.filter(x => x.id !== k.id) }),
            ),
          )}
        </div>
        {addButton(t('campaigns.stats.addKpi'), () => patch({ kpis: [...b.kpis, newStatsKpi()] }))}
      </div>

      {/* Per-platform groups */}
      <div>
        <Label>{t('campaigns.stats.groupsSection')}</Label>
        <div className="space-y-3">
          {b.groups.map(g => (
            <div key={g.id} className="rounded-xl p-2.5 space-y-2" style={{ border: '1px solid var(--admin-border)' }}>
              <div className="flex items-center gap-1.5">
                <input
                  type="text" value={g.title} dir="auto"
                  placeholder={t('campaigns.stats.groupTitle')}
                  onChange={e => patch({ groups: b.groups.map(x => (x.id === g.id ? { ...x, title: e.target.value } : x)) })}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md text-xs font-bold outline-none"
                  style={fieldStyle}
                />
                <button
                  type="button"
                  onClick={() => patch({ groups: b.groups.filter(x => x.id !== g.id) })}
                  className="p-1.5 rounded-md shrink-0" style={{ color: 'var(--admin-text-muted)' }}
                  aria-label="מחיקת פלטפורמה"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                {g.kpis.map(k =>
                  kpiRow(
                    k,
                    p => patch({
                      groups: b.groups.map(x =>
                        x.id === g.id ? { ...x, kpis: x.kpis.map(y => (y.id === k.id ? { ...y, ...p } : y)) } : x,
                      ),
                    }),
                    () => patch({
                      groups: b.groups.map(x =>
                        x.id === g.id ? { ...x, kpis: x.kpis.filter(y => y.id !== k.id) } : x,
                      ),
                    }),
                  ),
                )}
              </div>
              {addButton(t('campaigns.stats.addKpi'), () => patch({
                groups: b.groups.map(x => (x.id === g.id ? { ...x, kpis: [...x.kpis, newStatsKpi()] } : x)),
              }))}
            </div>
          ))}
        </div>
        {addButton(t('campaigns.stats.addGroup'), () => patch({ groups: [...b.groups, newStatsGroup()] }))}
      </div>

      {/* Video-retention funnel */}
      <div>
        <Label>{t('campaigns.stats.funnelSection')}</Label>
        {!b.funnel ? (
          addButton(t('campaigns.stats.funnelEnable'), () => patch({ funnel: newViewFunnel(t('campaigns.stats.funnelDefaultTitle')) }))
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text" value={b.funnel.title} dir="auto"
                placeholder={t('campaigns.stats.funnelTitle')}
                onChange={e => patch({ funnel: { ...b.funnel!, title: e.target.value } })}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md text-xs font-bold outline-none"
                style={fieldStyle}
              />
              <button
                type="button" onClick={() => patch({ funnel: undefined })}
                className="p-1.5 rounded-md shrink-0" style={{ color: 'var(--admin-text-muted)' }}
                aria-label="הסרת משפך"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {b.funnel.stages.map(s => {
              const update = (p: Partial<StatsFunnelStage>) => patch({
                funnel: { ...b.funnel!, stages: b.funnel!.stages.map(x => (x.id === s.id ? { ...x, ...p } : x)) },
              })
              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  <input
                    type="text" value={s.label} dir="auto"
                    placeholder={t('campaigns.stats.funnelStage')}
                    onChange={e => update({ label: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-[11px] outline-none"
                    style={fieldStyle}
                  />
                  <input
                    type="text" value={s.value} dir="auto"
                    placeholder={t('campaigns.stats.kpiValue')}
                    onChange={e => update({ value: e.target.value })}
                    className="w-20 px-2 py-1.5 rounded-md text-[11px] outline-none tabular-nums"
                    style={fieldStyle}
                  />
                  <input
                    type="text" value={s.percent ?? ''} dir="auto"
                    placeholder="%"
                    onChange={e => update({ percent: e.target.value })}
                    className="w-16 px-2 py-1.5 rounded-md text-[11px] outline-none tabular-nums"
                    style={fieldStyle}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ funnel: { ...b.funnel!, stages: b.funnel!.stages.filter(x => x.id !== s.id) } })}
                    className="p-1.5 rounded-md shrink-0" style={{ color: 'var(--admin-text-muted)' }}
                    aria-label="מחיקת שלב"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--admin-text-muted)' }}>
              {t('campaigns.stats.funnelHint')}
            </p>
            {addButton(t('campaigns.stats.addStage'), () => patch({
              funnel: { ...b.funnel!, stages: [...b.funnel!.stages, newFunnelStage()] },
            }))}
          </div>
        )}
      </div>

      {/* Comparison table */}
      <div>
        <Label>{t('campaigns.stats.tableSection')}</Label>
        {!b.table ? (
          addButton(t('campaigns.stats.tableEnable'), () => patch({ table: { headers: ['', ''], rows: [] } }))
        ) : (
          <div className="space-y-1.5">
            {/* Header row */}
            <div className="flex items-center gap-1.5">
              {b.table.headers.map((h, hi) => (
                <input
                  key={hi}
                  type="text" value={h} dir="auto"
                  placeholder={`עמודה ${hi + 1}`}
                  onChange={e => patch({
                    table: { ...b.table!, headers: b.table!.headers.map((x, j) => (j === hi ? e.target.value : x)) },
                  })}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-[11px] font-bold outline-none"
                  style={fieldStyle}
                />
              ))}
              <button
                type="button"
                onClick={() => patch({
                  table: {
                    headers: [...b.table!.headers, ''],
                    rows: b.table!.rows.map(r => [...r, '']),
                  },
                })}
                className="p-1.5 rounded-md shrink-0" style={{ color: 'var(--admin-text-muted)' }}
                aria-label={t('campaigns.stats.addColumn')} title={t('campaigns.stats.addColumn')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Data rows */}
            {b.table.rows.map((row, ri) => (
              <div key={ri} className="flex items-center gap-1.5">
                {b.table!.headers.map((_, ci) => (
                  <input
                    key={ci}
                    type="text" value={row[ci] ?? ''} dir="auto"
                    onChange={e => patch({
                      table: {
                        ...b.table!,
                        rows: b.table!.rows.map((r, j) =>
                          j === ri ? b.table!.headers.map((__, k) => (k === ci ? e.target.value : r[k] ?? '')) : r,
                        ),
                      },
                    })}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-[11px] outline-none tabular-nums"
                    style={fieldStyle}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => patch({ table: { ...b.table!, rows: b.table!.rows.filter((_, j) => j !== ri) } })}
                  className="p-1.5 rounded-md shrink-0" style={{ color: 'var(--admin-text-muted)' }}
                  aria-label="מחיקת שורה"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {addButton(t('campaigns.stats.addRow'), () => patch({
              table: { ...b.table!, rows: [...b.table!.rows, b.table!.headers.map(() => '')] },
            }))}
          </div>
        )}
      </div>

      {/* Footnote */}
      <div>
        <Label>{t('campaigns.stats.noteLabel')}</Label>
        <input
          type="text" value={b.note ?? ''} dir="auto"
          placeholder={t('campaigns.stats.notePlaceholder')}
          onChange={e => patch({ note: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-xs outline-none"
          style={fieldStyle}
        />
      </div>
    </div>
  )
}
