"use client"

import * as React from 'react'
import { NewProformaPage } from '../../../../components/NewProformaPage'

export default function DermatNewProformaPage() {
  return (
    <React.Suspense fallback={null}>
      <NewProformaPage />
    </React.Suspense>
  )
}
