'use client'

import * as React from 'react'
import { Camera } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { flash } from '@open-mercato/ui/backend/FlashMessages'

export function TakePhotoButton({ entityId, recordId, onUploaded }: { entityId: string; recordId: string; onUploaded: () => void }) {
  const t = useT()
  const input = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const { runMutation } = useGuardedMutation({ contextId: `dermat-photo-${recordId}` })

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const form = new FormData()
      form.append('entityId', entityId)
      form.append('recordId', recordId)
      form.append('file', file, file.name || `photo-${Date.now()}.jpg`)
      const call = await runMutation({
        context: { entityId, recordId, action: 'photo' },
        mutationPayload: { entityId, recordId, fileName: file.name },
        operation: () => apiCall('/api/attachments', { method: 'POST', body: form }),
      })
      if (!call.ok) return flash(t('dermat_orders.photo.failed', 'The photo was not saved. Check the signal and take it again.'), 'error')
      flash(t('dermat_orders.photo.saved', 'Photo saved'), 'success')
      onUploaded()
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />
      <Button type="button" variant="outline" size="sm" className="h-10 w-full md:hidden" disabled={busy} onClick={() => input.current?.click()}>
        <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {busy ? t('dermat_orders.photo.saving', 'Saving the photo…') : t('dermat_orders.photo.take', 'Take photo')}
      </Button>
    </>
  )
}

export default TakePhotoButton
