"use client"

import * as React from 'react'
import { RequestPage } from '../../../../components/RequestPage'

export default function DermatRdRequestPage({ params }: { params?: { id?: string } }) {
  return <RequestPage key={params?.id} requestId={params?.id ?? ''} backHref="/backend/rnd/requests" />
}
