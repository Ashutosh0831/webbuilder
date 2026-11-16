'use client'

import React, { useState } from 'react'
import { useFormFields, useForm } from '@payloadcms/ui'

export default function AutoFillButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = useFormFields(([fields]) => fields.name?.value as string)
  const purpose = useFormFields(([fields]) => fields.purpose?.value as string)

  const { fields, replaceState, setModified } = useForm()

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/generate-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, purpose }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setModified(true)

      // Build a new state by merging current fields with AI data
      const newState = { ...fields }

      // Helper to update a single field state
      const setField = (path: string, value: any) => {
        if (newState[path]) {
          newState[path] = { ...newState[path], value, initialValue: value, valid: true }
        }
      }

      setField('intro', data.intro || '')
      setField('metaTitle', data.metaTitle || '')
      setField('metaDescription', data.metaDescription || '')
      setField('safetyNote', data.safetyNote || '')

      // For array fields, we need to set the array's value and let Payload recalculate rows
      if (data.harbourages) {
        const rows = data.harbourages.map((text: string) => ({ text }))
        if (newState['harbourages']) {
          newState['harbourages'] = {
            ...newState['harbourages'],
            value: rows,
            initialValue: rows,
            valid: true,
          }
        }
      }
      if (data.treatmentSteps) {
        if (newState['treatmentSteps']) {
          newState['treatmentSteps'] = {
            ...newState['treatmentSteps'],
            value: data.treatmentSteps,
            initialValue: data.treatmentSteps,
            valid: true,
          }
        }
      }
      if (data.faqs) {
        if (newState['faqs']) {
          newState['faqs'] = {
            ...newState['faqs'],
            value: data.faqs,
            initialValue: data.faqs,
            valid: true,
          }
        }
      }

      // Force the entire form to re-render with the new state
      replaceState(newState)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <button
        type="button"
        onClick={generate}
        disabled={loading || !name || !purpose}
        style={{ padding: '8px 16px', background: loading ? '#888' : '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'wait' : 'pointer' }}
      >
        {loading ? 'Generating...' : '✨ Auto-fill all fields'}
      </button>
      {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}
    </div>
  )
}