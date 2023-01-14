import * as core from '@actions/core'
import * as utils from './utils'
import config from './config'

const { perPage, olderThanDays, lastKeepDate } = config

const main = async (): Promise<void> => {
  try {
    core.info(`Searching for runs older than ${olderThanDays} days (before ${lastKeepDate})`)

    const totalCount = await utils.getTotalCount()
    const remainderPage = totalCount % perPage !== 0 ? 1 : 0
    const lastPage = Math.floor(totalCount / perPage) + remainderPage
    let deleted = 0

    for (let page = lastPage; page >= 0; page--) {
      const runs = await utils.getWorkflowRuns(page)
      const runIds = runs.filter(utils.shouldBeDeleted).map(run => run.id)

      if (runIds.length === 0) {
        core.info(`No runs to delete on page ${page}`)
        continue
      }

      core.info(`Deleting ${runIds.length} runs on page ${page}`)

      try {
        await utils.deleteWorkflowRuns(runIds)
        deleted += runIds.length
      } catch (e: any) {
        core.error(`Failed to delete runs: ${e.message}`)
      }
    }

    core.info(`Deleted ${deleted} runs`)
  } catch (error: any) {
    core.setFailed(`Action failed with error: ${error}`)
  }
}

main()
