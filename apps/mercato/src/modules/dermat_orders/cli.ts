import type { ModuleCli } from '@open-mercato/shared/modules/registry'
import { spawn } from 'child_process'
import path from 'path'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { syncGoogleSheet } from './lib/googleSheet'

function readFlag(args: string[], names: string[]): string {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    for (const name of names) {
      if (arg === `--${name}` && args[index + 1]) return args[index + 1]
      if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3)
    }
  }
  return ''
}

const seedTransactions: ModuleCli = {
  command: 'seed-transactions',
  async run(rest) {
    const tenantId = readFlag(rest, ['tenant', 'tenantId'])
    const organizationId = readFlag(rest, ['org', 'organizationId'])
    
    const scriptPath = path.resolve(process.cwd(), 'scripts/seed-dermat-transactions.js')
    const args = [scriptPath]
    if (tenantId) args.push('--tenant', tenantId)
    if (organizationId) args.push('--org', organizationId)

    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, args, { stdio: 'inherit' })
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Seed script exited with code ${code}`))
      })
    })
  },
}

const syncSheet: ModuleCli = {
  command: 'sync-sheet',
  async run(rest) {
    const tenantId = readFlag(rest, ['tenant', 'tenantId'])
    const organizationId = readFlag(rest, ['org', 'organizationId'])
    if (!tenantId || !organizationId) {
      console.error('Usage: mercato dermat_orders sync-sheet --tenant <tenantId> --org <organizationId>')
      return
    }
    const container = await createRequestContainer()
    const em = (container.resolve('em') as EntityManager).fork()
    try {
      const result = await syncGoogleSheet({ em, tenantId, organizationId, container })
      console.log(`Order book written to the Google Sheet: ${result.rows} rows`)
    } catch (error) {
      console.error(`Google Sheet not updated: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    }
  },
}

export default [seedTransactions, syncSheet]
