import * as core from '@actions/core'
import * as github from '@actions/github'
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import dayjs from 'dayjs'
import { Config } from './config'

/**
 * Get actions endpoint from the GitHub API
 */
const { actions } = github.getOctokit(process.env.GITHUB_TOKEN || '').rest

/**
 * Utility type to extract the type of array elements
 */
type ArrayElementType<T extends Array<unknown>> = T extends Array<infer R> ? R : never

/**
 * The type of the response from the GitHub API
 */
export type WorkflowRuns =
  RestEndpointMethodTypes['actions']['listWorkflowRunsForRepo']['response']['data']['workflow_runs']

/**
 * The type of a single run
 */
export type WorkflowRun = ArrayElementType<WorkflowRuns>

/**
 * Check if a run should be deleted
 * @param run the run to check
 * @returns true if the run should be deleted
 */
export const shouldBeDeleted = (
  { ignoreOpenPullRequests, lastKeepDate, ignoredConclusionStates }: Config,
  run: Pick<WorkflowRun, 'pull_requests' | 'id' | 'created_at' | 'conclusion'>,
) => {
  if (ignoreOpenPullRequests && run.pull_requests && run.pull_requests?.length > 0) {
    core.debug(`Ignoring run ${run.id} because it has open pull requests`)
    return false
  } else if (dayjs(run.created_at).isAfter(lastKeepDate)) {
    core.debug(`Ignoring run ${run.id} because it is newer than ${lastKeepDate}`)
    return false
  } else if (run.conclusion === null || ignoredConclusionStates.includes(run.conclusion)) {
    core.debug(`Ignoring run ${run.id} because it is in state ${run.conclusion || 'null (in progress)'}`)
    return false
  }

  return true
}

/**
 * Get the total number of runs
 * @returns the total number of runs
 */
export const getTotalCount = async ({ repo }: Config): Promise<number> => {
  const { total_count } = (await actions.listWorkflowRunsForRepo({ ...repo, page: 0 })).data
  return total_count
}

/**
 * Get the runs for a given page
 * @param page the page to get
 * @returns the runs for the given page
 */
export const getWorkflowRuns = async (
  { repo, perPage }: Config,
  page: number,
): Promise<WorkflowRuns> => {
  const response = await actions.listWorkflowRunsForRepo({
    ...repo,
    page,
    perPage,
  })

  return response.data.workflow_runs
}

/**
 * Delete a list of runs
 * @param runs the list of runs to delete
 */
export const deleteWorkflowRuns = async ({ repo }: Config, runs: number[]): Promise<void> => {
  await Promise.all(runs.map(id => actions.deleteWorkflowRun({ ...repo, run_id: id })))
}
