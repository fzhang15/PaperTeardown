interface Props {
  onSubmit: (url: string) => void
  loading: boolean
  error?: string | null
}

const GITHUB_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+/

export function UrlInput({ onSubmit, loading, error }: Props) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const url = (e.currentTarget.elements.namedItem('url') as HTMLInputElement).value.trim()
    onSubmit(url)
  }

  const validate = (url: string) =>
    url.length > 0 && !GITHUB_RE.test(url) ? 'Must be a GitHub repo URL' : null

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 600 }}>
        <input
          name="url"
          type="text"
          placeholder="https://github.com/..."
          style={{ flex: 1, padding: '8px 12px', fontSize: 15, borderRadius: 4, border: '1px solid #ccc' }}
          disabled={loading}
          onChange={(e) => {
            const v = validate(e.target.value)
            e.target.setCustomValidity(v ?? '')
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '8px 20px', fontSize: 15, borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>
      {error && <p role="alert" style={{ color: '#c00', margin: 0 }}>{error}</p>}
    </form>
  )
}
