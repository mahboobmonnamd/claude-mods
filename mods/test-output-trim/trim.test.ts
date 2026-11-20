import { expect, test } from 'claude-code/testing'

import { trimTestOutput } from './hooks/register.ts'

const passing = Array.from({ length: 400 }, (_, i) => `  ✓ case ${i} (3ms)`)

test('a failure keeps its context and the passing lines are left out', async () => {
  const lines = [...passing.slice(0, 200), '  ✗ widget renders', 'AssertionError: expected 1 to be 2', '    at widget.test.ts:12', ...passing.slice(200), 'Tests: 1 failed, 400 passed']
  const out = trimTestOutput(lines.join('\n'))
  expect(out.text).toContain('✗ widget renders')
  expect(out.text).toContain('AssertionError: expected 1 to be 2')
  expect(out.text).toContain('Tests: 1 failed, 400 passed')
  expect(out.text).not.toContain('case 100 ')
  expect(out.dropped).toBeGreaterThan(300)
})

test('a run that only passes keeps its head, tail and summary', async () => {
  const out = trimTestOutput([...passing, 'Tests: 400 passed'].join('\n'))
  expect(out.text).toContain('Tests: 400 passed')
  expect(out.text).toContain('lines left out')
})

test('a flood of failures is capped but the tail survives', async () => {
  const flood = Array.from({ length: 2000 }, (_, i) => `FAIL test ${i}`)
  const out = trimTestOutput([...flood, 'Tests: 2000 failed'].join('\n'))
  expect(out.kept).toBeLessThanOrEqual(300)
  expect(out.text).toContain('Tests: 2000 failed')
})
