import { expect, test } from 'claude-code/testing'
import { writeFullTestLog } from './hooks/log.ts'

test('a successful write returns a recoverable path and prunes separately', async () => {
  const calls: string[][] = []
  const log = '/tmp/test-logs/test-12345678.log'
  const saved = await writeFullTestLog('/tmp/test-logs', 'FULL FAILURE DETAIL', async (args, options) => {
    calls.push(args)
    if (calls.length === 1) {
      expect(options.stdin).toBe('FULL FAILURE DETAIL')
      return { exitCode: 0, stdout: log + '\n' }
    }
    return { exitCode: 0, stdout: '' }
  })
  expect(saved).toBe(log)
  expect(calls.length).toBe(2)
})

test('failed, malformed and missing writes never trim original tool output', async () => {
  const dir = '/tmp/test-logs'
  const failed = await writeFullTestLog(dir, 'failure', async () => ({ exitCode: 1, stdout: '' }))
  expect(failed).toBe(undefined)
  const malformed = await writeFullTestLog(dir, 'failure', async () => ({ exitCode: 0, stdout: 'not a log path' }))
  expect(malformed).toBe(undefined)
  const thrown = await writeFullTestLog(dir, 'failure', async () => { throw new Error('disk full') })
  expect(thrown).toBe(undefined)
})

test('a cleanup failure does not invalidate a successfully saved log', async () => {
  let runs = 0
  const log = '/tmp/test-logs/test-12345678.log'
  const saved = await writeFullTestLog('/tmp/test-logs', 'full output', async () => {
    runs++
    if (runs === 1) return { exitCode: 0, stdout: log + '\n' }
    throw new Error('cleanup failed')
  })
  expect(saved).toBe(log)
})
