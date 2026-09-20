'use client'

import * as React from 'react'
import { ClipboardList } from 'lucide-react'
import { createManufacturingRenderer } from './ManufacturingNotificationRenderer'

export const NewOrderRenderer = createManufacturingRenderer({
  icon: <ClipboardList className="size-5 text-status-info-icon" aria-hidden="true" />,
  iconBgClass: 'bg-status-info-bg',
  unreadDotClass: 'bg-status-info-icon',
  viewLabel: 'View Order',
})

export default NewOrderRenderer
