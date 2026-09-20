import { BrandLogo } from './BrandLogo'

export function Loading({ label = 'Загружаем материалы…' }: { label?: string }) {
  return (
    <div className="state-card loading-state">
      <BrandLogo />
      <span className="spinner" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state-card">
      <div className="state-icon">!</div>
      <h2>Не удалось загрузить</h2>
      <p>{message}</p>
      <button className="button primary" onClick={onRetry}>Попробовать снова</button>
    </div>
  )
}
