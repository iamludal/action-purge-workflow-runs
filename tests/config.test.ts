import dayjs from "dayjs";
import { getConfig } from "../src/config";

describe('getConfig', () => {
  it.each([
    ['(default)', {}, 30, true],
    ['when olderThanDays input is valid number', { olderThanDays: '10' }, 10, true],
    ['when olderThanDays input is not a number', { olderThanDays: 'abc' }, 30, true],
    ['when olderThanDays input is negative', { olderThanDays: '-10' }, 30, true],
    ['when olderThanDays input is not provided', { olderThanDays: '' }, 30, true],
    ['when ignoreOpenPullRequests input is a boolean', { ignoreOpenPullRequests: 'true' }, 30, true],
    ['when ignoreOpenPullRequests input is not a boolean', { ignoreOpenPullRequests: 'abc' }, 30, false],
    ['when ignoreOpenPullRequests input is not provided', { ignoreOpenPullRequests: '' }, 30, false],
  ])('should return the config %s', (_, partialConfig, expectedOlderThanDays, expectedIgnoreOpenPullRequests) => {
    const config = getConfig({
      olderThanDays: '30',
      ignoreOpenPullRequests: 'true',
      github: {
        repo: {
          owner: 'dummy',
          repo: 'project',
        },
      },
      ...partialConfig,
    })

    expect(config.olderThanDays).toEqual(expectedOlderThanDays)
    expect(config.ignoreOpenPullRequests).toEqual(expectedIgnoreOpenPullRequests)
    expect(config.lastKeepDate.format('YYYY-MM-DD')).toEqual(dayjs().subtract(expectedOlderThanDays, 'days').format('YYYY-MM-DD'))
    expect(config.perPage).toEqual(10)
  });
})
