import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const deploymentId = 'AKfycbxmPu1N3gNT5cDvhtdWSNOzKfmHcYLFpLYErFpBVZ4FGuyEYX0xfOX2pxEPMkEJtkA8'
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const description = process.argv[2] ?? `version${packageJson.version}`
const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const claspPrefix = ['--yes', '@google/clasp@3.3.0']

function run(args, capture = false) {
  const result = spawnSync(executable, [...claspPrefix, ...args], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  })
  if (capture) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  }
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  return result.stdout ?? ''
}

run(['-P', 'apps-script', '-I', 'apps-script', 'push'])
const versionOutput = run(['-P', 'apps-script', 'version', description], true)
const versionNumber = versionOutput.match(/Created version (\d+)/)?.[1]
if (!versionNumber) throw new Error('No se pudo identificar la versión creada por clasp.')
run(['-P', 'apps-script', 'redeploy', deploymentId, '-V', versionNumber, '-d', description])
