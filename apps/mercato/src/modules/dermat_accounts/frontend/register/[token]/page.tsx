"use client"

import { RegistrationFormPage } from '../../../components/registration/RegistrationFormPage'

export default function DermatRegistrationPage({ params }: { params: { token: string } }) {
  return <RegistrationFormPage token={params?.token ?? ''} />
}
