"use client"

import * as React from 'react'
import { StepPage } from '../../../../../../../components/stage/StepPage'

export default function DermatOrderStepPage({ params }: { params?: { id?: string; key?: string; step?: string } }) {
  return <StepPage key={`${params?.id}-${params?.key}-${params?.step}`} orderId={params?.id ?? ''} stageKey={params?.key ?? ''} stepKey={params?.step ?? ''} />
}
