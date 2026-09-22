// The resting state of Maks: he sits on top of every screen, and tapping him
// starts listening right there rather than navigating anywhere.

import { MaksMascot } from './MaksMascot'

type AssistantButtonProps = {
  onOpen: () => void
  /** Shown while the conversation chunk is still loading. */
  connecting?: boolean
}

export function AssistantButton({ onOpen, connecting = false }: AssistantButtonProps) {
  return (
    <div className="maks-dock">
      <div className="maks-launcher-row">
        <button
          className="maks-launcher"
          onClick={() => {
            if (connecting) return
            onOpen()
            window.Telegram?.WebApp.HapticFeedback?.impactOccurred('medium')
          }}
          aria-label="Поговорить с Максом"
        >
          <MaksMascot state={connecting ? 'connecting' : 'idle'} size={56} />
        </button>
      </div>
    </div>
  )
}
