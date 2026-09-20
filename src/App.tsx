import { useCallback, useEffect, useState } from 'react'
import { BrandLogo } from './components/BrandLogo'
import { CardsPage } from './components/CardsPage'
import { ReviewPage } from './components/ReviewPage'
import { TopicPage } from './components/TopicPage'
import { TopicsPage } from './components/TopicsPage'

type Screen = 'topics' | 'topic' | 'cards' | 'review'

function TopicsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-8Z" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

function CardsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </svg>
  )
}

function initialScreen(): Screen {
  return new URLSearchParams(window.location.search).get('screen') === 'review' ? 'review' : 'topics'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [topicSlug, setTopicSlug] = useState('gorod')
  const [reviewTopicID, setReviewTopicID] = useState<string | null>(null)

  const goBack = useCallback(() => {
    setScreen((current) => (current === 'review' ? (reviewTopicID ? 'topic' : 'cards') : 'topics'))
  }, [reviewTopicID])

  useEffect(() => {
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    if (screen === 'topic' || screen === 'review') backButton.show()
    else backButton.hide()
    backButton.onClick(goBack)
    return () => backButton.offClick(goBack)
  }, [screen, goBack])

  return (
    <div className={`app-shell ${screen === 'review' ? 'review-mode' : ''}`}>
      {screen !== 'review' && (
        <header className={`topbar ${screen === 'topic' ? 'has-back' : ''}`}>
          <div className="topbar-leading">
            {screen === 'topic' && (
              <button className="topbar-back" onClick={goBack} aria-label="Назад к темам">
                <span aria-hidden="true">←</span>
              </button>
            )}
            <button className="wordmark" onClick={() => setScreen('topics')} aria-label="На главную">
              <BrandLogo compact />
            </button>
          </div>
          <span className="topbar-caption">Русский каждый день</span>
        </header>
      )}

      <main className="main-content">
        {screen === 'topics' && (
          <TopicsPage
            onOpen={(slug) => {
              setTopicSlug(slug)
              setScreen('topic')
            }}
          />
        )}
        {screen === 'topic' && (
          <TopicPage
            slug={topicSlug}
            onReview={(topicID) => {
              setReviewTopicID(topicID)
              setScreen('review')
            }}
          />
        )}
        {screen === 'cards' && (
          <CardsPage
            onReview={() => {
              setReviewTopicID(null)
              setScreen('review')
            }}
            onBrowse={() => setScreen('topics')}
          />
        )}
        {screen === 'review' && (
          <ReviewPage
            topicID={reviewTopicID ?? undefined}
            onDone={() => setScreen(reviewTopicID ? 'topic' : 'cards')}
          />
        )}
      </main>

      {screen !== 'review' && (
        <nav className="bottom-nav" aria-label="Основная навигация">
          <button
            className={screen === 'topics' || screen === 'topic' ? 'active' : ''}
            onClick={() => setScreen('topics')}
            aria-current={screen === 'topics' || screen === 'topic' ? 'page' : undefined}
          >
            <span className="nav-icon"><TopicsIcon /></span>
            Темы
          </button>
          <button
            className={screen === 'cards' ? 'active' : ''}
            onClick={() => setScreen('cards')}
            aria-current={screen === 'cards' ? 'page' : undefined}
          >
            <span className="nav-icon"><CardsIcon /></span>
            Карточки
          </button>
        </nav>
      )}
    </div>
  )
}
