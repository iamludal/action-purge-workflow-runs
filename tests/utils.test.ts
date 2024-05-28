import * as core from '@actions/core'
import { Config, getConfig } from '../src/config'
import {
  WorkflowRun,
  deleteWorkflowRuns,
  getTotalCount,
  getWorkflowRuns,
  shouldBeDeleted,
} from '../src/utils'
import dayjs from 'dayjs'

/**
 * Mocking the GitHub API
 */
jest.mock('@actions/core')
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn().mockReturnValue({
    rest: {
      actions: {
        deleteWorkflowRun: jest.fn().mockImplementation(async ({ repo, run_id }) => {
          if (repo === 'failing-repo' || run_id === 12345678) {
            throw new Error('Mocked Error: Something went wrong')
          }
        }),
        listWorkflowRunsForRepo: jest.fn().mockImplementation(async ({ repo }) => {
          if (repo === 'failing-repo') {
            throw new Error('Mocked Error: Something went wrong')
          }

          return {
            data: {
              total_count: 1,
              workflow_runs: [
                {
                  id: 12345678,
                  pull_requests: [],
                  created_at: '2023-01-07T12:34:56Z',
                  conclusion: 'success',
                },
              ],
            },
          }
        }),
      },
    },
  }),
}))

/**
 * Holding the config object
 */
let config: Config

/**
 * Reset the mocks after each test
 */
afterEach(() => {
  jest.restoreAllMocks()
})

/**
 * Reset the config before each test
 */
beforeEach(() => {
  config = getConfig({
    olderThanDays: '10',
    ignoreOpenPullRequests: 'true',
    github: {
      repo: {
        owner: 'dummy',
        repo: 'project',
      },
    },
  })
})

/**
 * Testing shoudBeDeleted logic
 */
describe('shouldBeDeleted', () => {
  const debugSpy = jest.spyOn(core, 'debug')

  /**
   * Testing shouldBeDeleted logic by modifying the lastKeepDate from the config
   */
  it.each([
    [
      'should delete with a run created before the last keep date',
      '2023-01-17T12:34:56Z', // Exactly 10 days after the creation date
      true,
    ],
    [
      'should not delete with a run created after the last keep date',
      '2023-01-06T12:34:56Z', // Exactly 1 day before the creation date
      false,
      'Ignoring run 12345678 because it is newer than Fri, 06 Jan 2023 12:34:56 GMT',
    ],
  ])('%s', (_, lastKeepDate, expected, debugMessage = undefined) => {
    config.lastKeepDate = dayjs(lastKeepDate)

    const dummyRun = {
      id: 12345678,
      pull_requests: [],
      created_at: '2023-01-07T12:34:56Z',
      conclusion: 'success',
    }

    expect(shouldBeDeleted(config, dummyRun)).toBe(expected)
    if (debugMessage) {
      expect(debugSpy).toHaveBeenCalledWith(debugMessage)
    }
  })

  /**
   * Testing shouldBeDeleted logic by modifying the conclusion from the run
   */
  it.each([
    [
      'should not delete a run that is some kind of action required',
      'action_required',
      false,
      'Ignoring run 12345678 because it is in state action_required',
    ],
    [
      'should not delete a run with an undefined conclusion (in progress)',
      null,
      false,
      'Ignoring run 12345678 because it is in state null (in progress)',
    ],
    [
      'should not delete a run that is in progress',
      'in_progress',
      false,
      'Ignoring run 12345678 because it is in state in_progress',
    ],
    [
      'should not delete a run that is queued',
      'queued',
      false,
      'Ignoring run 12345678 because it is in state queued',
    ],
    [
      'should not delete a run that is requested',
      'requested',
      false,
      'Ignoring run 12345678 because it is in state requested',
    ],
    [
      'should not delete a run that is waiting',
      'waiting',
      false,
      'Ignoring run 12345678 because it is in state waiting',
    ],
    [
      'should not delete a run that is pending',
      'pending',
      false,
      'Ignoring run 12345678 because it is in state pending',
    ],

    ['should delete with a run that is completed', 'skipped', true],
    ['should delete with a run that was cancelled', 'cancelled', true],
    ['should delete with a run that has failed', 'failure', true],
    ['should delete with a run that was neutral', 'neutral', true],
    ['should delete with a run that was skipped', 'skipped', true],
    ['should delete with a run that was stale', 'stale', true],
    ['should delete with a run that was success', 'success', true],
    ['should delete with a run that was timed out', 'timed_out', true],
  ])('%s', (_, conclusion, expected, debugMessage = undefined) => {
    const dummyRun = {
      id: 12345678,
      pull_requests: [],
      created_at: '2019-01-07T12:34:56Z',
      conclusion,
    }

    expect(shouldBeDeleted(config, dummyRun)).toBe(expected)
    if (debugMessage) {
      expect(debugSpy).toHaveBeenCalledWith(debugMessage)
    }
  })

  /**
   * Testing shouldBeDeleted logic by modifying the pull requests from the run
   */
  describe('with open pull requests', () => {
    let dummyRun: Pick<WorkflowRun, 'pull_requests' | 'id' | 'created_at' | 'conclusion'>

    beforeEach(() => {
      dummyRun = {
        id: 12345678,
        pull_requests: [
          {
            id: 987,
            number: 10,
            url: 'https://github.com/iamludal/action-purge-workflow-runs/pull/10',
            head: {
              ref: 'new-feature',
              sha: 'a1b2c3d4e5f678901234567890abcdef12345678',
              repo: {
                id: 123456,
                url: 'https://github.com/developer/new-feature-repo',
                name: 'new-feature-repo',
              },
            },
            base: {
              ref: 'main',
              sha: 'f1e2d3c4b5a678901234567890abcdef12345678',
              repo: {
                id: 654321,
                url: 'https://github.com/iamludal/action-purge-workflow-runs',
                name: 'action-purge-workflow-runs',
              },
            },
          },
        ],
        created_at: '2024-01-07T12:34:56Z', // Example ISO 8601 format
        conclusion: 'success', // Possible values: "success", "failure", "cancelled", etc.
      }
    })

    it('should not delete with config.ignoreOpenPullRequests is set to true', () => {
      config.ignoreOpenPullRequests = true

      expect(shouldBeDeleted(config, dummyRun)).toBe(false)
      expect(debugSpy).toHaveBeenCalledWith(
        `Ignoring run 12345678 because it has open pull requests`,
      )
    })

    it('should delete with config.ignoreOpenPullRequests is set to false', () => {
      config.ignoreOpenPullRequests = false
      dummyRun.created_at = '2019-01-07T12:34:56Z'

      expect(shouldBeDeleted(config, dummyRun)).toBe(true)
      expect(debugSpy).not.toHaveBeenCalled()
    })
  })

  /**
   * Testing shouldBeDeleted logic with no pull requests
   */

  it.each([
    ['and config.ignoreOpenPullRequests is set to true', true],
    ['and config.ignoreOpenPullRequests is set to false', false],
  ])('should delete with no open pull requests %s', (_, ignoreOpenPullRequests) => {
    config.ignoreOpenPullRequests = ignoreOpenPullRequests
    const dummyRun = {
      id: 12345678,
      pull_requests: [],
      created_at: '2019-01-07T12:34:56Z',
      conclusion: 'success',
    }

    expect(shouldBeDeleted(config, dummyRun)).toBe(true)
    expect(debugSpy).not.toHaveBeenCalled()
  })
})

/**
 * Testing getTotalCount logic with mocked GitHub API
 */
describe('getTotalCount', () => {
  it('should return the total count', async () => {
    await expect(getTotalCount(config)).resolves.toBe(1)
  })

  it('should throw an error if something went wrong', async () => {
    config.repo.repo = 'failing-repo'

    await expect(getTotalCount(config)).rejects.toThrow('Mocked Error: Something went wrong')
  })
})

/**
 * Testing getWorkflowRuns logic with mocked GitHub API
 */
describe('getWorkflowRuns', () => {
  it('should return the runs for the given page', async () => {
    await expect(getWorkflowRuns(config, 0)).resolves.toHaveLength(1)
  })

  it('should throw an error if something went wrong', async () => {
    config.repo.repo = 'failing-repo'

    await expect(getWorkflowRuns(config, 0)).rejects.toThrow('Mocked Error: Something went wrong')
  })
})

/**
 * Testing the delete logic with mocked GitHub API
 */
describe('deleteWorkflowRun', () => {
  it('should succeed with no run ids provided', async () => {
    await expect(deleteWorkflowRuns(config, [])).resolves.not.toThrow()
  })

  it('should succeed with run ids provided', async () => {
    await expect(deleteWorkflowRuns(config, [1, 2, 3])).resolves.not.toThrow()
  })

  it('should throw an error if something went wrong', async () => {
    config.repo.repo = 'failing-repo'

    await expect(deleteWorkflowRuns(config, [1, 2, 3])).rejects.toThrow(
      'Mocked Error: Something went wrong',
    )
  })

  it('should fail if one of the run ids could not be deleted', async () => {
    await expect(deleteWorkflowRuns(config, [1, 2, 12345678, 4])).rejects.toThrow(
      'Mocked Error: Something went wrong',
    )
  })

  it('should fail if all of the run ids could not be deleted', async () => {
    await expect(deleteWorkflowRuns(config, [12345678])).rejects.toThrow(
      'Mocked Error: Something went wrong',
    )
  })
})
