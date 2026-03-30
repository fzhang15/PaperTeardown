import type { AnalyzedModule, AnalyzedLoop } from '../types'

export type NavItem =
  | { kind: 'module'; index: number; label: string }
  | { kind: 'loop'; index: number; label: string }

interface Props {
  modules: AnalyzedModule[]
  loops: AnalyzedLoop[]
  selected: NavItem | null
  onSelect: (item: NavItem) => void
}

export function ModuleNav({ modules, loops, selected, onSelect }: Props) {
  const isSelected = (item: NavItem) =>
    selected !== null && selected.kind === item.kind && selected.index === item.index

  return (
    <nav style={{ width: 200, flexShrink: 0, borderRight: '1px solid #e5e7eb', padding: '12px 0', overflow: 'auto' }}>
      {modules.length > 0 && (
        <>
          <div style={{ padding: '4px 16px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
            Modules
          </div>
          {modules.map((m, i) => {
            const item: NavItem = { kind: 'module', index: i, label: m.module_name }
            return (
              <button
                key={i}
                onClick={() => onSelect(item)}
                style={{
                  width: '100%', textAlign: 'left', padding: '6px 16px', border: 'none',
                  background: isSelected(item) ? '#eff6ff' : 'transparent',
                  color: isSelected(item) ? '#3b82f6' : '#374151',
                  fontWeight: isSelected(item) ? 600 : 400,
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                {m.module_name}
              </button>
            )
          })}
        </>
      )}
      {loops.length > 0 && (
        <>
          <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
            Training Loops
          </div>
          {loops.map((l, i) => {
            const item: NavItem = { kind: 'loop', index: i, label: `Loop L${l.start_line}` }
            return (
              <button
                key={i}
                onClick={() => onSelect(item)}
                style={{
                  width: '100%', textAlign: 'left', padding: '6px 16px', border: 'none',
                  background: isSelected(item) ? '#eff6ff' : 'transparent',
                  color: isSelected(item) ? '#3b82f6' : '#374151',
                  fontWeight: isSelected(item) ? 600 : 400,
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                {item.label}
              </button>
            )
          })}
        </>
      )}
    </nav>
  )
}
