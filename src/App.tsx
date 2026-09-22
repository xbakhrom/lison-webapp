import { useCallback, useEffect, useState } from 'react'
import { BrandLogo } from './components/BrandLogo'
import { CardsPage } from './components/CardsPage'
import { FeedbackSheet } from './components/FeedbackSheet'
import { GrammarPage } from './components/GrammarPage'
import { GrammarTopicPage } from './components/GrammarTopicPage'
import { ReviewPage } from './components/ReviewPage'
import { TopicPage } from './components/TopicPage'
import { TopicsPage } from './components/TopicsPage'

type Screen = 'topics' | 'topic' | 'grammar' | 'grammar-topic' | 'cards' | 'review'

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

function GrammarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4.5h9a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5Z" />
      <path d="M16 8h3v12h-3M8.5 9h4M8.5 13h4" />
    </svg>
  )
}

function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 15.5a2 2 0 0 1-2 2H9l-5 3v-15a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10Z" />
      <path d="M8 8.5h8M8 12.5h5" />
    </svg>
  )
}

function initialScreen(): Screen {
  const requested = new URLSearchParams(window.location.search).get('screen')
  if (requested === 'review' || requested === 'grammar') return requested
  return 'topics'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [topicSlug, setTopicSlug] = useState('gorod')
  const [grammarSlug, setGrammarSlug] = useState('rod-i-chislo')
  const [grammarReview, setGrammarReview] = useState(false)
  const [reviewTopicID, setReviewTopicID] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const goBack = useCallback(() => {
    setScreen((current) => {
      if (current === 'review') return reviewTopicID ? 'topic' : 'cards'
      if (current === 'grammar-topic') return 'grammar'
      return 'topics'
    })
  }, [reviewTopicID])

  useEffect(() => {
    const backButton = window.Telegram?.WebApp.BackButton
    if (!backButton) return
    if (screen === 'topic' || screen === 'grammar-topic' || screen === 'review') backButton.show()
    else backButton.hide()
    backButton.onClick(goBack)
    return () => backButton.offClick(goBack)
  }, [screen, goBack])

  return (
    <div className={`app-shell ${screen === 'review' || screen === 'grammar-topic' ? 'review-mode' : ''}`}>
      {screen !== 'review' && (
        <header className={`topbar ${screen === 'topic' || screen === 'grammar-topic' ? 'has-back' : ''}`}>
          <div className="topbar-leading">
            {(screen === 'topic' || screen === 'grammar-topic') && (
              <button className="topbar-back" onClick={goBack} aria-label="Назад">
                <span aria-hidden="true">←</span>
              </button>
            )}
            <button className="wordmark" onClick={() => setScreen('topics')} aria-label="На главную">
              <BrandLogo compact />
            </button>
          </div>
          <div className="topbar-actions">
            <span className="topbar-caption">Русский каждый день</span>
            <button
              className="feedback-trigger"
              onClick={() => {
                setFeedbackOpen(true)
                window.Telegram?.WebApp.HapticFeedback?.impactOccurred('light')
              }}
              aria-label="Отправить предложение"
            >
              <FeedbackIcon />
            </button>
          </div>
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
        {screen === 'grammar' && (
          <GrammarPage
            onOpen={(slug, review) => {
              setGrammarSlug(slug)
              setGrammarReview(review)
              setScreen('grammar-topic')
            }}
          />
        )}
        {screen === 'grammar-topic' && (
          <GrammarTopicPage
            slug={grammarSlug}
            review={grammarReview}
            onDone={() => setScreen('grammar')}
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

      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        screen={screen}
        topicSlug={screen === 'topic' ? topicSlug : ''}
      />

      {screen !== 'review' && screen !== 'grammar-topic' && (
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
            className={screen === 'grammar' ? 'active' : ''}
            onClick={() => setScreen('grammar')}
            aria-current={screen === 'grammar' ? 'page' : undefined}
          >
            <span className="nav-icon"><GrammarIcon /></span>
            Грамматика
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
