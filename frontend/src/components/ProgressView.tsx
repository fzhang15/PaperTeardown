import type { JobStatus } from '../types'

interface Props {
  status: JobStatus
  onCancel: () => void
}

const STEPS = ['cloning', 'parsing', 'analyzing'] as const
type Step = typeof STEPS[number]

const STEP_LABELS: Record<Step, string> = {
  cloning: 'Cloning repository',
  parsing: 'Parsing PyTorch code',
  analyzing: 'Analyzing modules',
}

function stepIndex(s: string) {
  return STEPS.indexOf(s as Step)
}

export function ProgressView({ status, onCancel }: Props) {
  const current = stepIndex(status.status)

  return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24 }}>
        {STEPS.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: done ? '#22c55e' : active ? '#3b82f6' : '#e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: done || active ? '#fff' : '#9ca3af', fontWeight: 700,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, color: active ? '#3b82f6' : done ? '#22c55e' : '#9ca3af' }}>
                {STEP_LABELS[step]}
              </span>
            </div>
          )
        })}
      </div>

      {status.status === 'analyzing' && status.progress.current_module && (
        <p style={{ color: '#6b7280' }}>
          Analyzing <strong>{status.progress.current_module}</strong>
          {status.progress.modules_total > 0 && (
            <> ({status.progress.modules_done}/{status.progress.modules_total})</>
          )}
        </p>
      )}

      <button onClick={onCancel} style={{ marginTop: 16, padding: '6px 16px', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  )
}
