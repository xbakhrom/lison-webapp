type TelegramWebApp = {
  initData: string
  colorScheme: 'light' | 'dark'
  ready: () => void
  expand: () => void
  close: () => void
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp }
}
