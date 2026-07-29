'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  STAFF_OUTREACH_BUILTIN_TEMPLATE_ID,
  nextStaffOutreachTemplateName,
  type StaffOutreachMessageChannel,
  type StaffOutreachMessageLocale,
  type StaffOutreachMessageTemplateRow,
  type StaffOutreachTemplateScope,
} from '@/lib/staffOutreachMessageTemplates'

export type StaffOutreachBuiltinTemplate = {
  name: string
  subject: string
  body: string
}

export type UseStaffOutreachMessageTemplatesOptions = {
  scope: StaffOutreachTemplateScope
  locale: StaffOutreachMessageLocale
  channel: StaffOutreachMessageChannel
  variant: string
  isOpen: boolean
  showSubject: boolean
  getBuiltin: () => StaffOutreachBuiltinTemplate
  prepareBodyForEditor: (storedBody: string) => string
  prepareBodyForSave: (editorBody: string) => string
  loadFailedMessage: string
  saveFailedMessage: string
  deleteFailedMessage: string
  savedMessage: string
  deletedMessage: string
  addedMessage: string
}

export function useStaffOutreachMessageTemplates({
  scope,
  locale,
  channel,
  variant,
  isOpen,
  showSubject,
  getBuiltin,
  prepareBodyForEditor,
  prepareBodyForSave,
  loadFailedMessage,
  saveFailedMessage,
  deleteFailedMessage,
  savedMessage,
  deletedMessage,
  addedMessage,
}: UseStaffOutreachMessageTemplatesOptions) {
  const [templates, setTemplates] = useState<StaffOutreachMessageTemplateRow[]>([])
  const [selectedId, setSelectedId] = useState<string>(STAFF_OUTREACH_BUILTIN_TEMPLATE_ID)
  const [templateName, setTemplateName] = useState('')
  const [subjectTpl, setSubjectTpl] = useState('')
  const [bodyTpl, setBodyTpl] = useState('')
  const [templateEditorNonce, setTemplateEditorNonce] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const getBuiltinRef = useRef(getBuiltin)
  const prepareBodyForEditorRef = useRef(prepareBodyForEditor)
  getBuiltinRef.current = getBuiltin
  prepareBodyForEditorRef.current = prepareBodyForEditor

  const applyBuiltinToEditor = useCallback(() => {
    const builtin = getBuiltinRef.current()
    setTemplateName(builtin.name)
    setSubjectTpl(builtin.subject)
    setBodyTpl(prepareBodyForEditorRef.current(builtin.body))
    setTemplateEditorNonce((n) => n + 1)
  }, [])

  const applyRowToEditor = useCallback((row: StaffOutreachMessageTemplateRow) => {
    setTemplateName(row.name)
    setSubjectTpl(row.subject_template ?? '')
    setBodyTpl(prepareBodyForEditorRef.current(row.body_template))
    setTemplateEditorNonce((n) => n + 1)
  }, [])

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const qs = new URLSearchParams({
        scope,
        locale,
        channel,
        variant: variant || 'default',
      })
      const res = await fetch(`/api/staff-outreach-message-templates?${qs.toString()}`)
      const data = (await res.json()) as {
        templates?: StaffOutreachMessageTemplateRow[]
        error?: string
      }
      if (!res.ok) {
        setTemplates([])
        setSelectedId(STAFF_OUTREACH_BUILTIN_TEMPLATE_ID)
        applyBuiltinToEditor()
        setNotice(data.error || loadFailedMessage)
        return
      }
      const rows = data.templates ?? []
      setTemplates(rows)
      if (rows.length > 0) {
        const first = rows[0]
        setSelectedId(first.id)
        applyRowToEditor(first)
      } else {
        setSelectedId(STAFF_OUTREACH_BUILTIN_TEMPLATE_ID)
        applyBuiltinToEditor()
      }
    } catch {
      setTemplates([])
      setSelectedId(STAFF_OUTREACH_BUILTIN_TEMPLATE_ID)
      applyBuiltinToEditor()
      setNotice(loadFailedMessage)
    } finally {
      setLoading(false)
    }
  }, [
    scope,
    locale,
    channel,
    variant,
    applyBuiltinToEditor,
    applyRowToEditor,
    loadFailedMessage,
  ])

  useEffect(() => {
    if (!isOpen) {
      setNotice(null)
      return
    }
    void loadTemplates()
  }, [isOpen, loadTemplates])

  const selectTemplate = useCallback(
    (id: string) => {
      setSelectedId(id)
      if (id === STAFF_OUTREACH_BUILTIN_TEMPLATE_ID) {
        applyBuiltinToEditor()
        return
      }
      const row = templates.find((t) => t.id === id)
      if (row) applyRowToEditor(row)
    },
    [templates, applyBuiltinToEditor, applyRowToEditor]
  )

  const saveCurrentTemplate = useCallback(async () => {
    setSaving(true)
    setNotice(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const bodyToSave = prepareBodyForSave(bodyTpl)
      if (!bodyToSave.trim()) {
        setNotice(saveFailedMessage)
        return
      }
      if (showSubject && !subjectTpl.trim()) {
        setNotice(saveFailedMessage)
        return
      }

      if (selectedId === STAFF_OUTREACH_BUILTIN_TEMPLATE_ID) {
        const name =
          templateName.trim() || nextStaffOutreachTemplateName(locale, templates.map((t) => t.name))
        const res = await fetch('/api/staff-outreach-message-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope,
            locale,
            channel,
            variant: variant || 'default',
            name,
            subject_template: showSubject ? subjectTpl : null,
            body_template: bodyToSave,
            sort_order: templates.length,
            updated_by: user?.email ?? null,
          }),
        })
        const data = (await res.json()) as {
          template?: StaffOutreachMessageTemplateRow
          error?: string
        }
        if (!res.ok || !data.template) {
          setNotice(data.error || saveFailedMessage)
          return
        }
        const created = data.template
        setTemplates((prev) => [...prev, created])
        setSelectedId(created.id)
        setTemplateName(created.name)
        setNotice(savedMessage)
      } else {
        const res = await fetch('/api/staff-outreach-message-templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedId,
            name: templateName.trim() || undefined,
            subject_template: showSubject ? subjectTpl : null,
            body_template: bodyToSave,
            updated_by: user?.email ?? null,
          }),
        })
        const data = (await res.json()) as {
          template?: StaffOutreachMessageTemplateRow
          error?: string
        }
        if (!res.ok || !data.template) {
          setNotice(data.error || saveFailedMessage)
          return
        }
        const updated = data.template
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        setTemplateName(updated.name)
        setNotice(savedMessage)
      }
      window.setTimeout(() => setNotice(null), 3200)
    } catch {
      setNotice(saveFailedMessage)
    } finally {
      setSaving(false)
    }
  }, [
    bodyTpl,
    subjectTpl,
    showSubject,
    selectedId,
    templateName,
    locale,
    templates,
    scope,
    channel,
    variant,
    prepareBodyForSave,
    saveFailedMessage,
    savedMessage,
  ])

  const addNewTemplate = useCallback(async () => {
    setAdding(true)
    setNotice(null)
    try {
      const builtin = getBuiltinRef.current()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const name = nextStaffOutreachTemplateName(locale, templates.map((t) => t.name))
      const res = await fetch('/api/staff-outreach-message-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          locale,
          channel,
          variant: variant || 'default',
          name,
          subject_template: showSubject ? builtin.subject : null,
          body_template: prepareBodyForSave(prepareBodyForEditorRef.current(builtin.body)),
          sort_order: templates.length,
          updated_by: user?.email ?? null,
        }),
      })
      const data = (await res.json()) as {
        template?: StaffOutreachMessageTemplateRow
        error?: string
      }
      if (!res.ok || !data.template) {
        setNotice(data.error || saveFailedMessage)
        return
      }
      const created = data.template
      setTemplates((prev) => [...prev, created])
      setSelectedId(created.id)
      applyRowToEditor(created)
      setNotice(addedMessage)
      window.setTimeout(() => setNotice(null), 3200)
    } catch {
      setNotice(saveFailedMessage)
    } finally {
      setAdding(false)
    }
  }, [
    locale,
    templates,
    scope,
    channel,
    variant,
    showSubject,
    prepareBodyForSave,
    applyRowToEditor,
    saveFailedMessage,
    addedMessage,
  ])

  const deleteCurrentTemplate = useCallback(async () => {
    if (selectedId === STAFF_OUTREACH_BUILTIN_TEMPLATE_ID) return
    setDeleting(true)
    setNotice(null)
    try {
      const res = await fetch(
        `/api/staff-outreach-message-templates?id=${encodeURIComponent(selectedId)}`,
        { method: 'DELETE' }
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setNotice(data.error || deleteFailedMessage)
        return
      }
      const remaining = templates.filter((t) => t.id !== selectedId)
      setTemplates(remaining)
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id)
        applyRowToEditor(remaining[0])
      } else {
        setSelectedId(STAFF_OUTREACH_BUILTIN_TEMPLATE_ID)
        applyBuiltinToEditor()
      }
      setNotice(deletedMessage)
      window.setTimeout(() => setNotice(null), 3200)
    } catch {
      setNotice(deleteFailedMessage)
    } finally {
      setDeleting(false)
    }
  }, [
    selectedId,
    templates,
    applyBuiltinToEditor,
    applyRowToEditor,
    deleteFailedMessage,
    deletedMessage,
  ])

  const isBuiltinSelected = selectedId === STAFF_OUTREACH_BUILTIN_TEMPLATE_ID
  const savedInDb = !isBuiltinSelected

  return {
    templates,
    selectedId,
    selectTemplate,
    templateName,
    setTemplateName,
    subjectTpl,
    setSubjectTpl,
    bodyTpl,
    setBodyTpl,
    templateEditorNonce,
    loading,
    saving,
    deleting,
    adding,
    notice,
    setNotice,
    isBuiltinSelected,
    savedInDb,
    loadTemplates,
    saveCurrentTemplate,
    addNewTemplate,
    deleteCurrentTemplate,
  }
}
