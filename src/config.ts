import { Context } from '@actions/github/lib/context'
import dayjs from 'dayjs'

export type Config = Pick<Context, 'repo'> & {
  olderThanDays: number
  ignoreOpenPullRequests: boolean
  lastKeepDate: dayjs.Dayjs
  perPage: number
  ignoredConclusionStates: string[]
}

interface ConfigContext {
  olderThanDays: string
  ignoreOpenPullRequests: string
  github: Pick<Context, 'repo'>
}

/**
 * Get the config object from the action context.
 *
 * @param context The context of the action with action inputs and github context.
 * @returns The config object.
 */
export function getConfig(context: ConfigContext): Config {
  let olderThanDays = parseInt(context.olderThanDays || '30')
  const ignoreOpenPullRequests = context.ignoreOpenPullRequests === 'true'

  if (isNaN(olderThanDays) || olderThanDays < 0) {
    olderThanDays = 30
  }

  return {
    olderThanDays,
    ignoreOpenPullRequests,
    lastKeepDate: dayjs().subtract(olderThanDays, 'days'),
    repo: context.github.repo,
    perPage: 10,
    ignoredConclusionStates: [
      'action_required',
      'in_progress',
      'queued',
      'requested',
      'waiting',
      'pending',
    ],
  }
}
