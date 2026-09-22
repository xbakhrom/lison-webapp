// The tools Maks can call. Declarations go into the Live session setup; the
// dispatcher below turns each call into a normal authenticated Lison REST
// request, so the assistant reaches exactly what the learner already can.

import { Behavior, FunctionResponseScheduling, Type } from '@google/genai'
import type { FunctionDeclaration } from '@google/genai'
import { ApiError, api } from '../api'

/** What a dispatched tool hands back to the session. */
export type ToolResult = {
  response: Record<string, unknown>
  /** Set for writes so the model folds the result in without stalling the turn. */
  scheduling?: FunctionResponseScheduling
}

/** Side effects worth reflecting in the rest of the app. */
export type ToolEffects = {
  onCardsChanged?: () => void
  onTopicChanged?: () => void
}

// Writes are declared non-blocking: the learner keeps talking while the request
// is in flight, and the result is folded in at the next natural pause.
const writeBehavior = { behavior: Behavior.NON_BLOCKING }

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_vocabulary',
    description:
      'Search the Lison vocabulary catalogue for a Russian or Uzbek word. Returns catalogue ids needed by add_flashcards. Use this before claiming a word is or is not in the catalogue.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The word to look for, in Russian or Uzbek.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_flashcards',
    description:
      'Add catalogue words to the learner\'s spaced-repetition deck. Pass ids returned by search_vocabulary. Ask the learner first.',
    ...writeBehavior,
    parameters: {
      type: Type.OBJECT,
      properties: {
        ids: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Catalogue ids from search_vocabulary.',
        },
      },
      required: ['ids'],
    },
  },
  {
    name: 'add_custom_word',
    description:
      'Save a word that is not in the catalogue as the learner\'s own flashcard. Supply the Russian word and your Uzbek translation. Use this when search_vocabulary found nothing.',
    ...writeBehavior,
    parameters: {
      type: Type.OBJECT,
      properties: {
        russian: { type: Type.STRING, description: 'The Russian word or phrase.' },
        uzbek: { type: Type.STRING, description: 'The Uzbek translation.' },
      },
      required: ['russian', 'uzbek'],
    },
  },
  {
    name: 'get_due_cards',
    description:
      'List the flashcards due for review today, so you can drill them out loud. Returns card ids for submit_review.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topicId: { type: Type.STRING, description: 'Optional topic id to review only that lesson.' },
      },
    },
  },
  {
    name: 'submit_review',
    description:
      'Record how well the learner recalled one flashcard during a spoken review. Call it once per card, right after they answer.',
    ...writeBehavior,
    parameters: {
      type: Type.OBJECT,
      properties: {
        cardId: { type: Type.NUMBER, description: 'Card id from get_due_cards.' },
        rating: {
          type: Type.STRING,
          enum: ['hard', 'good', 'easy'],
          description: 'hard = struggled, good = recalled with effort, easy = instant.',
        },
      },
      required: ['cardId', 'rating'],
    },
  },
  {
    name: 'get_topic_content',
    description: 'Read a lesson: its summary, vocabulary, open questions and the learner\'s own saved answers.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        slug: { type: Type.STRING, description: 'Lesson slug, for example "gorod".' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'save_topic_answer',
    description:
      'Save the learner\'s answer to one of a lesson\'s open questions, in their own words. Use the field id from get_topic_content.',
    ...writeBehavior,
    parameters: {
      type: Type.OBJECT,
      properties: {
        topicId: { type: Type.STRING },
        fieldId: { type: Type.STRING },
        text: { type: Type.STRING, description: 'The answer, in the language the learner used.' },
      },
      required: ['topicId', 'fieldId', 'text'],
    },
  },
  {
    name: 'mark_checklist_item',
    description: 'Tick off a lesson checklist item once the learner has genuinely covered it out loud.',
    ...writeBehavior,
    parameters: {
      type: Type.OBJECT,
      properties: {
        topicId: { type: Type.STRING },
        itemId: { type: Type.STRING },
        checked: { type: Type.BOOLEAN },
      },
      required: ['topicId', 'itemId', 'checked'],
    },
  },
  {
    name: 'get_discussion_question',
    description:
      'Fetch a conversation question the learner has not discussed yet. Use it when the conversation needs a fresh direction.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topicId: { type: Type.STRING, description: 'Optional: keep the question inside this lesson.' },
      },
    },
  },
  {
    name: 'set_learner_level',
    description:
      'Record the learner\'s Russian level once you have heard enough of their speech to judge it. Call it at most once per conversation, and only when your estimate changed.',
    ...writeBehavior,
    parameters: {
      type: Type.OBJECT,
      properties: {
        level: {
          type: Type.STRING,
          enum: ['A1', 'A2', 'B1', 'B2'],
          description: 'CEFR level you judged from how they actually speak.',
        },
      },
      required: ['level'],
    },
  },
  {
    name: 'log_discussion',
    description:
      'Record that a discussion question was covered, with a one or two sentence summary of what the learner said.',
    ...writeBehavior,
    parameters: {
      type: Type.OBJECT,
      properties: {
        questionId: { type: Type.STRING },
        summary: { type: Type.STRING, description: 'Short summary in the learner\'s own words.' },
      },
      required: ['questionId', 'summary'],
    },
  },
]

type Args = Record<string, unknown>

function text(args: Args, key: string): string {
  const value = args[key]
  return typeof value === 'string' ? value.trim() : ''
}

function number(args: Args, key: string): number | null {
  const value = args[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return null
}

const quiet = FunctionResponseScheduling.WHEN_IDLE

/**
 * Runs one tool call. Failures come back as `{ ok: false, error }` rather than
 * throwing, so a bad call never drops the conversation.
 */
export async function runTool(name: string, args: Args, effects: ToolEffects = {}): Promise<ToolResult> {
  try {
    switch (name) {
      case 'search_vocabulary': {
        const query = text(args, 'query')
        if (!query) return { response: { ok: false, error: 'query is required' } }
        const { results } = await api.searchVocabulary(query)
        return {
          response: {
            ok: true,
            results: results.map((item) => ({
              id: item.id,
              russian: item.russian,
              uzbek: item.uzbek,
              topic: item.topicTitle,
              alreadyInDeck: item.added,
            })),
          },
        }
      }

      case 'add_flashcards': {
        const raw = args.ids
        const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
        if (ids.length === 0) return { response: { ok: false, error: 'ids is required' }, scheduling: quiet }
        const { added } = await api.addCards(ids)
        effects.onCardsChanged?.()
        return { response: { ok: true, added, requested: ids.length }, scheduling: quiet }
      }

      case 'add_custom_word': {
        const russian = text(args, 'russian')
        const uzbek = text(args, 'uzbek')
        if (!russian || !uzbek) {
          return { response: { ok: false, error: 'russian and uzbek are required' }, scheduling: quiet }
        }
        const saved = await api.addCustomWord(russian, uzbek)
        effects.onCardsChanged?.()
        return {
          response: { ok: true, cardId: saved.cardId, alreadySaved: !saved.created },
          scheduling: quiet,
        }
      }

      case 'get_due_cards': {
        const topicId = text(args, 'topicId')
        const { cards } = await api.dueCards(topicId || undefined)
        return {
          response: {
            ok: true,
            count: cards.length,
            // Cap the payload: a long deck would crowd out the conversation.
            cards: cards.slice(0, 20).map((card) => ({
              cardId: card.id,
              russian: card.russian,
              uzbek: card.uzbek,
              topic: card.topicTitle,
            })),
          },
        }
      }

      case 'submit_review': {
        const cardId = number(args, 'cardId')
        const rating = text(args, 'rating')
        if (cardId === null || !['hard', 'good', 'easy'].includes(rating)) {
          return { response: { ok: false, error: 'cardId and a rating of hard|good|easy are required' }, scheduling: quiet }
        }
        const result = await api.review(cardId, rating as 'hard' | 'good' | 'easy')
        effects.onCardsChanged?.()
        return { response: { ok: true, nextDue: result.dueDate, intervalDays: result.intervalDays }, scheduling: quiet }
      }

      case 'get_topic_content': {
        const slug = text(args, 'slug')
        if (!slug) return { response: { ok: false, error: 'slug is required' } }
        const topic = await api.topic(slug)
        return {
          response: {
            ok: true,
            topicId: topic.id,
            title: topic.title,
            summary: topic.summary,
            level: topic.level,
            vocabulary: topic.vocabulary.flatMap((category) =>
              category.items.map((item) => ({ russian: item.russian, uzbek: item.uzbek, inDeck: item.added })),
            ),
            questions: topic.forms.flatMap((section) =>
              section.fields.map((field) => ({
                fieldId: field.id,
                label: field.label,
                answered: hasAnswer(field.value),
              })),
            ),
            checklist: topic.checklist.flatMap((group) =>
              group.items.map((item) => ({ itemId: item.id, prompt: item.prompt, done: item.checked })),
            ),
          },
        }
      }

      case 'save_topic_answer': {
        const topicId = text(args, 'topicId')
        const fieldId = text(args, 'fieldId')
        const value = text(args, 'text')
        if (!topicId || !fieldId || !value) {
          return { response: { ok: false, error: 'topicId, fieldId and text are required' }, scheduling: quiet }
        }
        await api.saveAnswer(topicId, fieldId, value)
        effects.onTopicChanged?.()
        return { response: { ok: true }, scheduling: quiet }
      }

      case 'mark_checklist_item': {
        const topicId = text(args, 'topicId')
        const itemId = text(args, 'itemId')
        if (!topicId || !itemId) {
          return { response: { ok: false, error: 'topicId and itemId are required' }, scheduling: quiet }
        }
        await api.saveChecklist(topicId, itemId, args.checked !== false)
        effects.onTopicChanged?.()
        return { response: { ok: true }, scheduling: quiet }
      }

      case 'get_discussion_question': {
        const topicId = text(args, 'topicId')
        const question = await api.nextDiscussion(topicId || undefined)
        if (!question) return { response: { ok: true, exhausted: true } }
        return {
          response: {
            ok: true,
            questionId: question.id,
            question: question.question,
            uzbekHint: question.uzbekHint,
            followUps: question.followUps,
          },
        }
      }

      case 'set_learner_level': {
        const level = text(args, 'level').toUpperCase()
        if (!['A1', 'A2', 'B1', 'B2'].includes(level)) {
          return { response: { ok: false, error: 'level must be one of A1, A2, B1, B2' }, scheduling: quiet }
        }
        await api.setAssistantLevel(level)
        return { response: { ok: true, level }, scheduling: quiet }
      }

      case 'log_discussion': {
        const questionId = text(args, 'questionId')
        const summary = text(args, 'summary')
        if (!questionId || !summary) {
          return { response: { ok: false, error: 'questionId and summary are required' }, scheduling: quiet }
        }
        await api.logDiscussion(questionId, summary)
        return { response: { ok: true }, scheduling: quiet }
      }

      default:
        return { response: { ok: false, error: `unknown tool ${name}` } }
    }
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'request failed'
    return { response: { ok: false, error: message } }
  }
}

function hasAnswer(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  return value != null && value !== ''
}
