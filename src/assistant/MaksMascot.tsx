// Maks: the face of the voice tutor. Drawn inline like Barsik in the game, so
// there is no asset to download, no licence to honour and nothing added to the
// bundle budget. The headset says "voice" without needing a label.

export type MascotState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'paused'

type MaksMascotProps = {
  state?: MascotState
  size?: number
  /** Microphone level 0..1, used to make him lean in while the learner talks. */
  level?: number
}

export function MaksMascot({ state = 'idle', size = 44, level = 0 }: MaksMascotProps) {
  return (
    <span
      className={`maks maks-${state}`}
      style={{ width: size, height: size, '--maks-level': level } as React.CSSProperties}
      aria-hidden="true"
    >
      {/* Cropped to a portrait: at launcher size the face has to carry the
          whole character, so the empty margins are not worth the pixels. */}
      <svg viewBox="7 7 50 50">
        {/* Shoulders */}
        <path className="maks-body" d="M14 64v-6a18 18 0 0 1 36 0v6Z" />
        <path className="maks-collar" d="M26 47.5 32 54l6-6.5" />

        {/* Neck and head */}
        <path className="maks-skin" d="M28.5 40h7v7h-7Z" />
        <rect className="maks-skin" x="18" y="13" width="28" height="30" rx="12" />

        {/* Short hair, swept to one side */}
        <path
          className="maks-hair"
          d="M18 26v-3a14 14 0 0 1 28 0v3c-1.6-3.2-2.4-6-8.5-6.8-4.6-.6-8.4.9-11 3.4A9.5 9.5 0 0 0 18 26Z"
        />
        <path className="maks-brow" d="M23.5 26.5h5.5M35 26.5h5.5" />

        {/* Eyes: the blink is a CSS transform so it costs nothing to animate */}
        <g className="maks-eyes">
          <circle className="maks-eye" cx="26.2" cy="31" r="2.5" />
          <circle className="maks-eye" cx="37.8" cy="31" r="2.5" />
          <circle className="maks-glint" cx="27.1" cy="30.1" r="0.8" />
          <circle className="maks-glint" cx="38.7" cy="30.1" r="0.8" />
        </g>
        <circle className="maks-blush" cx="21.5" cy="34.5" r="2.6" />
        <circle className="maks-blush" cx="42.5" cy="34.5" r="2.6" />

        {/* Mouth: a line when quiet, an open oval while he speaks */}
        <path className="maks-mouth-quiet" d="M28.6 37.4c1.4 1.6 5.4 1.6 6.8 0" />
        <ellipse className="maks-mouth-open" cx="32" cy="37.6" rx="3.1" ry="2.4" />

        {/* Headset */}
        <path className="maks-band" d="M15.5 30v-4a16.5 16.5 0 0 1 33 0v4" />
        <rect className="maks-cup" x="11.5" y="27" width="8" height="12" rx="4" />
        <rect className="maks-cup" x="44.5" y="27" width="8" height="12" rx="4" />
        <path className="maks-boom" d="M19 37c0 5.5-3 8.5-7.5 9.5" />
        <circle className="maks-boom-tip" cx="11" cy="46.8" r="2.2" />
      </svg>

      {/* Listening ring, rendered outside the SVG so it can overflow the face */}
      <span className="maks-ring" />
      <span className="maks-ring maks-ring-late" />
    </span>
  )
}
