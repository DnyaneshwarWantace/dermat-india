'use client'

import * as React from 'react'
import { ExternalLink, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@wantace/ui/primitives/button'
import { IconButton } from '@wantace/ui/primitives/icon-button'
import { cn } from '@wantace/shared/lib/utils'
import { formatRelativeTime } from '@wantace/shared/lib/time'
import { useLocale, useT } from '@wantace/shared/lib/i18n/context'
import type { NotificationRendererProps } from '@wantace/shared/modules/notifications/types'

type ManufacturingRendererConfig = {
  icon: React.ReactNode
  iconBgClass: string
  unreadDotClass: string
  viewButtonClass?: string
  viewLabel: string
  extraInfo?: (props: NotificationRendererProps, t: ReturnType<typeof useT>) => React.ReactNode
}

export function createManufacturingRenderer(config: ManufacturingRendererConfig) {
  return function ManufacturingNotification({
    notification,
    onAction,
    onDismiss,
    actions = [],
  }: NotificationRendererProps) {
    const t = useT()
    const locale = useLocale()
    const router = useRouter()
    const [executing, setExecuting] = React.useState(false)
    const isUnread = notification.status === 'unread'

    const viewAction = actions.find((a) => a.id === 'view-production-order' || a.id === 'view-order') ?? actions[0] ?? null

    const handleView = async () => {
      if (!viewAction) {
        if (notification.linkHref) router.push(notification.linkHref)
        return
      }
      setExecuting(true)
      try {
        await onAction(viewAction.id)
      } finally {
        setExecuting(false)
      }
    }

    const timeAgo = formatRelativeTime(notification.createdAt, { locale, translate: t }) ?? ''
    const orderNumber = notification.bodyVariables?.orderNumber ?? notification.titleVariables?.orderNumber
    const productName = notification.bodyVariables?.productName ?? notification.titleVariables?.productName

    return (
      <div
        className={cn(
          'group relative flex gap-4 items-start rounded-xl p-3 transition-colors hover:bg-muted/40 cursor-pointer',
          isUnread && 'bg-muted/20',
        )}
        onClick={handleView}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleView()
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className={cn('relative shrink-0 flex size-10 items-center justify-center rounded-full', config.iconBgClass)}>
          {config.icon}
          {isUnread ? (
            <span
              className={cn('absolute -right-1 -top-1 size-3 rounded-full ring-2 ring-background', config.unreadDotClass)}
              aria-hidden="true"
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-sm font-medium leading-5 tracking-tight text-foreground">
            {notification.title}
          </p>

          <div className="text-xs leading-4 text-muted-foreground">
            {timeAgo ? (
              <>
                <span className="whitespace-nowrap">{timeAgo}</span>
                <span aria-hidden="true" className="mx-1 text-text-disabled">&middot;</span>
              </>
            ) : null}
            {orderNumber ? (
              <>
                <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-overline text-foreground">
                  {orderNumber}
                </span>
                <span aria-hidden="true" className="mx-1 text-text-disabled">&middot;</span>
              </>
            ) : null}
            {productName ? (
              <span className="whitespace-nowrap font-medium text-foreground">{productName}</span>
            ) : null}
            {config.extraInfo?.({ notification, onAction, onDismiss, actions }, t)}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              className={cn('h-8 rounded-md px-2.5', config.viewButtonClass)}
              onClick={(e) => {
                e.stopPropagation()
                handleView()
              }}
              disabled={executing || (!viewAction && !notification.linkHref)}
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              {config.viewLabel}
              {executing ? <Loader2 className="ml-1 size-3 animate-spin" /> : null}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-md px-2.5"
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
            >
              {t('notifications.actions.dismiss', 'Dismiss')}
            </Button>
          </div>
        </div>

        <IconButton
          type="button"
          variant="ghost"
          size="xs"
          className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          aria-label={t('notifications.actions.dismiss', 'Dismiss')}
        >
          <X className="size-3.5" />
        </IconButton>
      </div>
    )
  }
}
