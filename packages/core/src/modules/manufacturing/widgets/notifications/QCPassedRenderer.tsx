'use client'

import * as React from 'react'
import { BadgeCheck } from 'lucide-react'
import { createManufacturingRenderer } from './ManufacturingNotificationRenderer'

export const QCPassedRenderer = createManufacturingRenderer({
  icon: <BadgeCheck className="size-5 text-status-success-icon" aria-hidden="true" />,
  iconBgClass: 'bg-status-success-bg',
  unreadDotClass: 'bg-status-success-icon',
  viewLabel: 'View Production Order',
})

export default QCPassedRenderer
