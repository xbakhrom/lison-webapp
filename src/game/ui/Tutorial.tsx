import { useState } from 'react'
import { t } from '../i18n'
import { markTutorialDone } from '../save/store'
import { BarsikFace } from './Barsik'

const steps = ['tutorial.move', 'tutorial.look', 'tutorial.interact', 'tutorial.gold', 'tutorial.hint']

/** Spec §8: a short coached first run. It never blocks the scene — the player
 *  tries each control while the card is up. */
export function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const last = step === steps.length - 1

  return (
    <div className="tm-tutorial">
      <BarsikFace size={38} />
      <div className="tm-tutorial-body">
        <b>{t('tutorial.title')}</b>
        <p>{t(steps[step])}</p>
        <div className="tm-dots" aria-hidden="true">
          {steps.map((_, index) => (
            <i key={index} className={index === step ? 'is-on' : ''} />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="tm-primary"
        onClick={() => {
          if (!last) {
            setStep((current) => current + 1)
            return
          }
          markTutorialDone()
          onDone()
        }}
      >
        {last ? t('tutorial.done') : t('rules.next')}
      </button>
    </div>
  )
}
