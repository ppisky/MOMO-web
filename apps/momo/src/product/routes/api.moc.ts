import type { ActionFunctionArgs } from '../lib/server/handler-types'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { record, list, text, uuid } from '../contracts/core'
import { actionInput, actionError, core } from '../lib/server/actions.server'
import { spacesHost } from '../lib/server/spaces.server'
import { CoreError } from '../lib/server/core.server'
import { configurationSelection, configurationCount } from '../contracts/moc'
import { exportConfiguration } from '../lib/server/moc-config.server'
export async function action({ request }: ActionFunctionArgs) {
  let directory: string | undefined
  try {
    const input = await actionInput(request)
    const raw = record(input.plan)
    const configuration = configurationSelection(input.configuration)
    const allowed = ['characters', 'conversations', 'memory', 'semantic_graph', 'compatibility']
    if (Object.keys(raw).some((k) => !allowed.includes(k))) throw Error('Invalid export scope')
    const space = (v: unknown) => {
      const id = uuid(v)
      spacesHost().requireSpace(id)
      return id
    }
    const characters = list(raw.characters, (v) => {
      const c = record(v)
      return { space_id: space(c.space_id), character_ids: list(c.character_ids, uuid) }
    })
    for (const selection of characters) {
      const roles = await core(selection.space_id).characters()
      if (selection.character_ids.some((id) => !roles.some((r) => r.id === id)))
        throw new CoreError(400, 'invalid_character_selection')
    }
    const plan = {
      characters,
      conversations: list(raw.conversations, space),
      memory: list(raw.memory, space),
      semantic_graph: list(raw.semantic_graph, space),
      compatibility: text(raw.compatibility, 'compatibility'),
    }
    if (
      !['none', 'preserved_source', 'generated_ccv2_json', 'generated_ccv3_json', 'generated_ccv3_charx'].includes(
        plan.compatibility
      )
    )
      throw Error('Invalid compatibility')
    if (
      ![plan.characters, plan.conversations, plan.memory, plan.semantic_graph].some((v) => v.length) &&
      !configurationCount(configuration)
    )
      throw new CoreError(400, 'empty_export')
    const protection = record(input.protection)
    if (protection.type !== 'none' && protection.type !== 'passphrase') throw Error('Invalid protection')
    const password = protection.type === 'passphrase' ? text(protection.value, 'passphrase') : ''
    if (protection.type === 'passphrase' && (!password.length || password.length > 1024))
      throw new CoreError(400, 'invalid_passphrase')
    directory = await mkdtemp(join(tmpdir(), 'momo-web-export-'))
    const hostModules = await exportConfiguration(directory, configuration, input.preferences)
    if (
      !hostModules.length &&
      ![plan.characters, plan.conversations, plan.memory, plan.semantic_graph].some((v) => v.length)
    )
      throw new CoreError(400, 'empty_export')
    const path = join(directory, 'export.moc')
    await core().request(
      '/v1/moc/export',
      {
        method: 'POST',
        body: JSON.stringify({
          output_path: path,
          plan,
          protection: password ? { type: 'passphrase', value: password } : { type: 'none' },
          host_modules: hostModules,
        }),
      },
      120000
    )
    const file = await open(path, 'r')
    const length = (await file.stat()).size
    const ownedDirectory = directory
    let closed = false
    async function cleanup() {
      if (closed) return
      closed = true
      await file.close()
      await rm(ownedDirectory, { recursive: true, force: true })
    }
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const buffer = new Uint8Array(65536)
          const { bytesRead } = await file.read(buffer)
          if (bytesRead) controller.enqueue(buffer.subarray(0, bytesRead))
          else {
            await cleanup()
            controller.close()
          }
        } catch (e) {
          await cleanup()
          controller.error(e)
        }
      },
      async cancel() {
        await cleanup()
      },
    })
    directory = undefined // stream owns cleanup from this point
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(length),
        'Content-Disposition': `attachment; filename="MOMO-${new Date().toISOString().slice(0, 10)}.moc"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (directory) await rm(directory, { recursive: true, force: true })
    return actionError(error)
  }
}
