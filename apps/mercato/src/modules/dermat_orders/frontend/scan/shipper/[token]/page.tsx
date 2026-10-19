"use client"

import { ShipperScanPage } from '../../../../components/labels/ShipperScanPage'

export default function DermatShipperScanPage({ params }: { params: { token: string } }) {
  return <ShipperScanPage token={params?.token ?? ''} />
}
