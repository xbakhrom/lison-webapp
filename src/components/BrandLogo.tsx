export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-logo ${compact ? 'compact' : ''}`} aria-label="Lison.ai">
      <span aria-hidden="true" />
    </span>
  )
}
