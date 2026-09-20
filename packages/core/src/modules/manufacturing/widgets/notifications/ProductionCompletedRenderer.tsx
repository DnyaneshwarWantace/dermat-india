'use client'

import * as React from 'react'
import { PackageCheck } from 'lucide-react'
import { createManufacturingRenderer } from './ManufacturingNotificationRenderer'

export const ProductionCompletedRenderer = createManufacturingRenderer({
  icon: <PackageCheck className="size-5 text-status-success-icon" aria-hidden="true" />,
  iconBgClass: 'bg-status-success-bg',
  unreadDotClass: 'bg-status-success-icon',
  viewLabel: 'View Production Order',
  extraInfo: ({ notification }) => {
    const producedQuantity = notification.bodyVariables?.producedQuantity
    if (!producedQuantity) return null
    return (
      <>
        <span aria-hidden="true" className="mx-1 text-text-disabled">&middot;</span>
        <span className="whitespace-nowrap font-medium text-status-success-text">{producedQuantity} produced</span>
      </>
    )
  },
})

export default ProductionCompletedRenderer
