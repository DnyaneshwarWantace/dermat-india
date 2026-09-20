'use client'
import * as React from 'react'
import { apiCall } from './apiCall'

type FeatureCheckResponse = {
  ok: boolean
  granted: string[]
  userId: string
  userEmail?: string
}

export type CurrentUser = {
  userId: string
  email: string
}

/**
 * Read the current user's id and email on the client. Returns `{ userId: '', email: '' }`
 * until the request resolves.
 *
 * Same `/api/auth/feature-check` piggy-back as `useCurrentUserId` (see its doc comment) —
 * this variant also surfaces `userEmail` from the JWT claims so callers that need a
 * human-readable "who did this" label (e.g. an actor field on a confirmation dialog) don't
 * have to display a raw user id, and don't need the admin-gated `auth.users.list` permission
 * a users-list lookup would require just to read one's own identity.
 */
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = React.useState<CurrentUser>({ userId: '', email: '' })
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiCall<FeatureCheckResponse>('/api/auth/feature-check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ features: [] }),
        })
        if (!cancelled && res.ok && typeof res.result?.userId === 'string') {
          setUser({ userId: res.result.userId, email: res.result.userEmail ?? '' })
        }
      } catch {
        if (!cancelled) setUser({ userId: '', email: '' })
      }
    })()
    return () => { cancelled = true }
  }, [])
  return user
}
