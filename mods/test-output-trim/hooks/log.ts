// Keep this pure and dependency-injected so failure paths can be tested
// without invoking a real subprocess or persisting user test logs.
type ProcessResult = { exitCode: number; stdout: string }
type Run = (args: string[], options: { stdin?: string; timeoutMs: number }) => Promise<ProcessResult>

const WRITE = `
set -eu
d="$1"
mkdir -p "$d"
f=$(mktemp "$d/test-XXXXXXXX")
if ! cat > "$f"; then
  rm -f "$f"
  exit 1
fi
mv "$f" "$f.log"
printf '%s\\n' "$f.log"
`

const CLEANUP = `
d="$1"
ls -t "$d"/test-*.log 2>/dev/null | tail -n +21 | while IFS= read -r old; do
  rm -f "$old"
done
`

/** Returns a recoverable path only after a successful full write. */
export async function writeFullTestLog(dir: string, text: string, run: Run): Promise<string | undefined> {
  try {
    const written = await run(['/bin/sh', '-c', WRITE, 'sh', dir], { stdin: text, timeoutMs: 10_000 })
    if (written.exitCode !== 0) return undefined
    const path = written.stdout.trim()
    if (!path.startsWith(`${dir}/test-`) || !path.endsWith('.log') || path.includes('\\n')) return undefined

    // Retention is best effort; losing a cleanup step must not lose this log.
    try {
      await run(['/bin/sh', '-c', CLEANUP, 'sh', dir], { timeoutMs: 10_000 })
    } catch {
      // The newly saved log is still recoverable.
    }
    return path
  } catch {
    return undefined
  }
}
