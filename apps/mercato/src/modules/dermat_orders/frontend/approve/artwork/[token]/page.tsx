"use client"

import { ArtworkApprovalPage } from '../../../../components/approval/ArtworkApprovalPage'

export default function DermatArtworkApprovalPage({ params }: { params: { token: string } }) {
  return <ArtworkApprovalPage token={params?.token ?? ''} />
}
