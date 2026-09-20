'use client'

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { createManufacturingRenderer } from './ManufacturingNotificationRenderer'

export const MaterialsShortRenderer = createManufacturingRenderer({
  icon: <AlertTriangle className="size-5 text-status-warning-icon" aria-hidden="true" />,
  iconBgClass: 'bg-status-warning-bg',
  unreadDotClass: 'bg-status-warning-icon',
  viewLabel: 'View Production Order',
  extraInfo: ({ notification }) => {
    const shortItems = notification.bodyVariables?.shortItems
    if (!shortItems) return null
    return (
      <>
        <span aria-hidden="true" className="mx-1 text-text-disabled">&middot;</span>
        <span className="whitespace-nowrap text-status-warning-text">{shortItems} short</span>
      </>
    )
  },
})

export default MaterialsShortRenderer
