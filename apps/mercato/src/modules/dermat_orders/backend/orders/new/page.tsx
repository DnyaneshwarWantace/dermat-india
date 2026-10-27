"use client"

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { OrderForm } from '../../../components/OrderForm'

function NewOrder() {
  const searchParams = useSearchParams()
  const copyFrom = searchParams?.get('copyFrom') ?? undefined
  const customerId = searchParams?.get('customerId') ?? undefined
  const fromPi = searchParams?.get('fromPi') ?? undefined
  return <OrderForm key={copyFrom ?? fromPi ?? customerId ?? 'new'} copyFrom={copyFrom} customerId={customerId} fromPi={fromPi} />
}

export default function NewDermatOrderPage() {
  return (
    <React.Suspense fallback={null}>
      <NewOrder />
    </React.Suspense>
  )
}
