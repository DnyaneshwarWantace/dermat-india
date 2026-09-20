'use client'

import * as React from 'react'
import { CheckCircle } from 'lucide-react'
import { createManufacturingRenderer } from './ManufacturingNotificationRenderer'

export const MaterialsReadyRenderer = createManufacturingRenderer({
  icon: <CheckCircle className="size-5 text-status-success-icon" aria-hidden="true" />,
  iconBgClass: 'bg-status-success-bg',
  unreadDotClass: 'bg-status-success-icon',
  viewLabel: 'View Production Order',
})

export default MaterialsReadyRenderer
