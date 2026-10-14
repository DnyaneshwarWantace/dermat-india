"use client"

import * as React from 'react'
import { RequestPage } from '../../../../components/RequestPage'

export default function DermatSalesSamplePage({ params }: { params?: { id?: string } }) {
  return <RequestPage key={params?.id} requestId={params?.id ?? ''} backHref="/backend/sales/samples" />
}
