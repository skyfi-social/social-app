import {jwtDecode} from 'jwt-decode'

import {hasProp} from '#/lib/type-guards'
import {logger} from '#/logger'
import * as persisted from '#/state/persisted'
import {type SessionAccount} from './types'

export function readLastActiveAccount() {
  const {currentAccount, accounts} = persisted.get('session')
  return accounts.find(a => a.did === currentAccount?.did)
}

export function isSignupQueued(accessJwt: string | undefined) {
  if (accessJwt) {
    // OAuth tokens are not JWTs, so they won't have signup queue info
    if (!accessJwt.startsWith('ey')) {
      return false
    }
    try {
      const sessData = jwtDecode(accessJwt)
      return (
        hasProp(sessData, 'scope') &&
        sessData.scope === 'com.atproto.signupQueued'
      )
    } catch (e) {
      logger.error(`session: could not decode jwt`, {
        accessJwt: accessJwt?.substring(0, 20) + '...',
      })
      return false
    }
  }
  return false
}

export function isSessionExpired(account: SessionAccount) {
  try {
    if (account.accessJwt) {
      // OAuth tokens are not JWTs, so they don't have expiration info
      // The OAuth client handles token refresh internally
      if (!account.accessJwt.startsWith('ey')) {
        return false
      }
      const decoded = jwtDecode(account.accessJwt)
      if (decoded.exp) {
        const didExpire = Date.now() >= decoded.exp * 1000
        return didExpire
      }
    }
  } catch (e) {
    logger.error(`session: could not decode jwt`, {
      accessJwt: account.accessJwt?.substring(0, 20) + '...',
    })
  }
  return true
}
