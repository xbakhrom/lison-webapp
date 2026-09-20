import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { FormField, FormSection } from '../types'

type CorrectionRow = { said: string; correct: string }

function AutoSaveField({ topicID, field }: { topicID: string; field: FormField }) {
  const [value, setValue] = useState<unknown>(field.value ?? field.initialValue)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setStatus('saving')
    const timer = window.setTimeout(() => {
      api.saveAnswer(topicID, field.id, value)
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'))
    }, 650)
    return () => window.clearTimeout(timer)
  }, [field.id, topicID, value])

  if (field.inputType === 'collection') {
    const rows = Array.isArray(value) ? value as CorrectionRow[] : []
    function changeRow(index: number, key: keyof CorrectionRow, text: string) {
      setValue(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: text } : row))
    }
    return (
      <div className="form-field collection-field">
        <div className="field-label-row"><span>{field.label}</span><SaveStatus status={status} /></div>
        {rows.map((row, index) => (
          <div className="correction-row" key={index}>
            <input value={row.said} onChange={(event) => changeRow(index, 'said', event.target.value)} placeholder="Я сказал" />
            <input value={row.correct} onChange={(event) => changeRow(index, 'correct', event.target.value)} placeholder="Правильно" />
            <button className="icon-button danger" onClick={() => setValue(rows.filter((_, rowIndex) => rowIndex !== index))} aria-label="Удалить строку">×</button>
          </div>
        ))}
        <button className="button ghost small" onClick={() => setValue([...rows, { said: '', correct: '' }])}>+ Добавить строку</button>
      </div>
    )
  }

  const text = typeof value === 'string' ? value : ''
  return (
    <label className="form-field">
      <div className="field-label-row"><span>{field.label}</span><SaveStatus status={status} /></div>
      {field.inputType === 'textarea' ? (
        <textarea value={text} onChange={(event) => setValue(event.target.value)} rows={3} placeholder="Напишите свой ответ…" />
      ) : (
        <input value={text} onChange={(event) => setValue(event.target.value)} placeholder="Ваш ответ" />
      )}
    </label>
  )
}

function SaveStatus({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null
  return <small className={`save-status ${status}`}>{status === 'saving' ? 'Сохранение…' : status === 'saved' ? 'Сохранено' : 'Не сохранено'}</small>
}

export function EditableSection({ topicID, section, open = false }: { topicID: string; section: FormSection; open?: boolean }) {
  return (
    <details className="editable-section" open={open}>
      <summary>
        <span>{section.title}</span>
        <span className="chevron">⌄</span>
      </summary>
      <div className="editable-fields">
        {section.fields.map((field) => <AutoSaveField key={field.id} topicID={topicID} field={field} />)}
      </div>
    </details>
  )
}
