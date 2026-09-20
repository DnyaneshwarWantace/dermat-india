import { redirect } from 'next/navigation'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'

export default async function Home() {
  const auth = await getAuthFromCookies()
  redirect(auth ? '/backend' : '/login')
}
