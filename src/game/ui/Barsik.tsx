import { t } from '../i18n'

export function BarsikFace({ size = 44 }: { size?: number }) {
  return (
    <span className="tm-barsik-face" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <path d="M11 17 8 7l10 4.5Zm26 0 3-10-10 4.5Z" />
        <ellipse cx="24" cy="27" rx="15" ry="13.5" />
        <circle className="eye" cx="18.5" cy="25" r="2.6" />
        <circle className="eye" cx="29.5" cy="25" r="2.6" />
        <path className="mouth" d="M24 30.5v2m0 0c-1.6 2-4.4 2-6 .3m6-.3c1.6 2 4.4 2 6 .3" />
        <path className="whisker" d="M9 27h6M33 27h6M9.5 31.5l5.5-1M38.5 31.5 33 30.5" />
      </svg>
    </span>
  )
}

type BubbleProps = {
  title?: string
  children: React.ReactNode
  tone?: 'default' | 'exception'
  onClose?: () => void
}

export function BarsikBubble({ title, children, tone = 'default', onClose }: BubbleProps) {
  return (
    <div className={`tm-bubble tone-${tone}`} role="status">
      <BarsikFace />
      <div className="tm-bubble-body">
        <b>{title ?? t('barsik.name')}</b>
        <div>{children}</div>
      </div>
      {onClose && (
        <button type="button" className="tm-bubble-close" onClick={onClose} aria-label={t('app.close')}>
          ×
        </button>
      )}
    </div>
  )
}
