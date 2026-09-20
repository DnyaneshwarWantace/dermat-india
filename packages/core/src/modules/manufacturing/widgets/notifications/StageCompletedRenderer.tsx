'use client'

import * as React from 'react'
import { CheckSquare } from 'lucide-react'
import { createManufacturingRenderer } from './ManufacturingNotificationRenderer'

export const StageCompletedRenderer = createManufacturingRenderer({
  icon: <CheckSquare className="size-5 text-status-info-icon" aria-hidden="true" />,
  iconBgClass: 'bg-status-info-bg',
  unreadDotClass: 'bg-status-info-icon',
  viewLabel: 'View Production Order',
  extraInfo: ({ notification }) => {
    const stageName = notification.bodyVariables?.stageName
    if (!stageName) return null
    return (
      <>
        <span aria-hidden="true" className="mx-1 text-text-disabled">&middot;</span>
        <span className="whitespace-nowrap">{stageName}</span>
      </>
    )
  },
})

export default StageCompletedRenderer
