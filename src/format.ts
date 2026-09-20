export function plural(count: number, one: string, few: string, many: string) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 > 10 && mod100 < 20) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export function cardsLabel(count: number) {
  return plural(count, 'карточка', 'карточки', 'карточек')
}

export function wordsLabel(count: number) {
  return plural(count, 'слово', 'слова', 'слов')
}

export function newWordsLabel(count: number) {
  return plural(count, 'новое слово', 'новых слова', 'новых слов')
}
