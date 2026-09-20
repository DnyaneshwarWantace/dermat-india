"use client"

import * as React from 'react'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Button } from '@open-mercato/ui/primitives/button'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { raiseCrudError } from '@open-mercato/ui/backend/utils/serverErrors'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { createLogger } from '@open-mercato/shared/lib/logger'

const logger = createLogger('catalog')

type CatalogSettingsResponse = {
  autoSkuPrefix?: string
}

const DEFAULT_PREFIX = 'PROD-'

export function AutoSkuPrefixSettings() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [prefix, setPrefix] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const loadError = t('catalog.settings.autoSkuPrefix.errors.load', 'Failed to load catalog settings.')

  const load = React.useCallback(async () => {
    try {
      const payload = await readApiResultOrThrow<CatalogSettingsResponse>(
        '/api/catalog/settings',
        undefined,
        { errorMessage: loadError, fallback: { autoSkuPrefix: DEFAULT_PREFIX } },
      )
      const value = payload.autoSkuPrefix?.trim() || DEFAULT_PREFIX
      setPrefix(value)
      setDraft(value)
    } catch (err) {
      logger.error('catalog.settings.load failed', { err })
      flash(loadError, 'error')
      setPrefix(DEFAULT_PREFIX)
      setDraft(DEFAULT_PREFIX)
    }
  }, [loadError])

  React.useEffect(() => {
    load().catch(() => {})
  }, [load, scopeVersion])

  const dirty = prefix !== null && draft.trim() !== prefix
  const invalid = draft.trim().length === 0

  const handleSave = React.useCallback(async () => {
    const next = draft.trim()
    if (!next || next === prefix) return
    setSaving(true)
    try {
      const call = await apiCall('/api/catalog/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ autoSkuPrefix: next }),
      })
      if (!call.ok) {
        await raiseCrudError(call.response, t('catalog.settings.autoSkuPrefix.errors.save', 'Failed to save catalog settings.'))
      }
      setPrefix(next)
      flash(t('catalog.settings.messages.saved', 'Settings saved.'), 'success')
    } catch (err) {
      logger.error('catalog.settings.save failed', { err })
      const message = err instanceof Error
        ? err.message
        : t('catalog.settings.autoSkuPrefix.errors.save', 'Failed to save catalog settings.')
      flash(message, 'error')
    } finally {
      setSaving(false)
    }
  }, [draft, prefix, t])

  return (
    <section className="border bg-card text-card-foreground shadow-sm">
      <div className="border-b px-6 py-4 space-y-1">
        <h2 className="text-lg font-semibold">
          {t('catalog.settings.autoSkuPrefix.title', 'Auto-generated product code')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'catalog.settings.autoSkuPrefix.description',
            'When a product is created without a typed code, one is generated automatically using this prefix (e.g. PROD-00001). Changing it only affects products created after the change — existing codes are never renumbered.',
          )}
        </p>
      </div>
      <div className="px-6 py-4">
        {prefix === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" />
            {t('catalog.settings.loading', 'Loading…')}
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="auto-sku-prefix">
                {t('catalog.settings.autoSkuPrefix.fieldLabel', 'Prefix')}
              </Label>
              <Input
                id="auto-sku-prefix"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
                className="w-48 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {t('catalog.settings.autoSkuPrefix.preview', 'Next code will look like')} {draft.trim() || DEFAULT_PREFIX}00001
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || invalid || saving}
              onClick={() => { void handleSave() }}
            >
              {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
