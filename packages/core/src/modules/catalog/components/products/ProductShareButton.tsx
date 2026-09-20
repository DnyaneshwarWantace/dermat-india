"use client"

import * as React from 'react'
import { Share2, Check } from 'lucide-react'
import { Button } from '@wantace/ui/primitives/button'
import { useT } from '@wantace/shared/lib/i18n/context'
import { createLogger } from '@wantace/shared/lib/logger'

const logger = createLogger('catalog')

export type ProductShareButtonProps = {
  productTitle: string
  className?: string
}

export function ProductShareButton({ productTitle, className }: ProductShareButtonProps) {
  const t = useT()
  const [copied, setCopied] = React.useState(false)

  const handleShare = React.useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: productTitle, url })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        logger.error('navigator.share failed', { err })
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      logger.error('Failed to copy product link to clipboard', { err })
    }
  }, [productTitle])

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleShare}
      className={className}
      aria-label={t('catalog.products.detail.share', 'Share product')}
      data-product-share-trigger=""
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
    </Button>
  )
}

export default ProductShareButton
