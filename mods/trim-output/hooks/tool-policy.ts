// Trim Web owns all web search and fetch results; treating them as ordinary
// connector output would run two summarizers and could remove citations twice.
const WEB_TOOL = /^(WebSearch|WebFetch)$|^mcp__.*(search|fetch|scrape|crawl|browse)/i

/** Whether Trim Output, rather than Trim Web, may rewrite a tool's result. */
export function matchesOutputTool(tool: string, configured: string): boolean {
  if (WEB_TOOL.test(tool)) return false
  return configured
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .some(p => (p.endsWith('*') ? tool.startsWith(p.slice(0, -1)) : tool === p))
}
