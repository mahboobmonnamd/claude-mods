import { expect, test } from 'claude-code/testing'
import { matchesOutputTool } from './hooks/tool-policy.ts'

const defaults = 'Read,WebFetch,Bash,mcp__*'

test('web search and fetch tools are reserved for trim-web', async () => {
  for (const name of ['WebSearch', 'WebFetch', 'mcp__github__search', 'mcp__docs__fetch', 'mcp__site__scrape', 'mcp__site__crawl', 'mcp__site__browse']) {
    expect(matchesOutputTool(name, defaults)).toBe(false)
    expect(matchesOutputTool(name, '*')).toBe(false)
  }
})

test('ordinary connector and local reads remain routable', async () => {
  for (const name of ['Read', 'Bash', 'mcp__github__get_issue', 'mcp__calendar__list_events']) {
    expect(matchesOutputTool(name, defaults)).toBe(true)
  }
  expect(matchesOutputTool('Write', defaults)).toBe(false)
  expect(matchesOutputTool('Read', 'Bash')).toBe(false)
  expect(matchesOutputTool('mcp__github__get_issue', 'mcp__github__get_*')).toBe(true)
})
