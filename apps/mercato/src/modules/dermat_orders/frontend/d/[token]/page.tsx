"use client"

import { DocLinkPage } from '../../../components/links/DocLinkPage'

export default function DermatDocLinkPage({ params }: { params: { token: string } }) {
  return <DocLinkPage token={params?.token ?? ''} />
}
