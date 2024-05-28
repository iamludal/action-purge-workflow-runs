import { getInput, info, debug, error, setFailed } from '@actions/core'
import { context } from '@actions/github'
import { getTotalCount, shouldBeDeleted, getWorkflowRuns, deleteWorkflowRuns } from './utils'
import { getConfig } from './config'

const main = async (): Promise<void> => {
  const config = getConfig({
    olderThanDays: getInput('older-than-days'),
    ignoreOpenPullRequests: getInput('ignore-open-pull-requests'),
    github: context,
  })

  try {
    info(
      `Searching for runs older than ${config.olderThanDays} days (before ${config.lastKeepDate})`,
    )

    const totalCount = await getTotalCount(config)
    const remainderPage = totalCount % config.perPage !== 0 ? 1 : 0
    const lastPage = Math.floor(totalCount / config.perPage) + remainderPage
    let deleted = 0

    for (let page = lastPage; page >= 0; page--) {
      const runs = await getWorkflowRuns(config, page)
      const runIds = runs.filter(run => shouldBeDeleted(config, run)).map(run => run.id)

      if (runIds.length === 0) {
        debug(`No runs to delete on page ${page}`)
        continue
      }

      info(`Deleting runs ${runIds}`)

      try {
        await deleteWorkflowRuns(config, runIds)
        deleted += runIds.length
      } catch (e: unknown) {
        if (e instanceof Error) {
          error(`Failed to delete runs: ${e.message}`)
        } else {
          error(`Failed to delete runs: ${e}`)
        }
      }
    }

    info(`Deleted ${deleted} runs`)
  } catch (e) {
    if (e instanceof Error) {
      setFailed(`Action failed with error: ${e.message}`)
    } else {
      setFailed(`Action failed with error: ${e}`)
    }
  }
}

main()
