import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { record, text } from '../../contracts/core'
import { models } from '../../contracts/models'
import { portablePreferences, type ConfigurationSelection, type SpaceConfig } from '../../contracts/moc'
import { promptSpaces } from '../../contracts/prompts'
import { core } from './actions.server'
import { readParameters } from './parameters.server'
import { spacesHost } from './spaces.server'
export async function exportConfiguration(directory: string, selection: ConfigurationSelection, preferences: unknown) {
  const modules: { id: string; input_path: string; dependencies: string[]; import_order: number }[] = []
  async function snapshot(id: string, value: unknown) {
    const path = join(directory, id)
    await mkdir(path)
    await writeFile(join(path, 'snapshot.json'), JSON.stringify({ schema: `${id}/1`, value }, null, 2) + '\n', {
      flag: 'wx',
    })
    modules.push({ id, input_path: path, dependencies: [], import_order: 2000 })
  }
  for (const id of [...selection.personal_spaces, ...Object.values(selection.spaces).flat()])
    spacesHost().requireSpace(id)
  if (selection.global.includes('models')) {
    const catalog = models(await (await core().request('/v1/model-configuration')).json())
    await snapshot('momo-web-models', {
      revision: catalog.revision,
      providers: catalog.providers.map(({ id, name, protocol, base_url, api_path }) => ({
        id,
        name,
        protocol,
        base_url,
        api_path,
      })),
      models: catalog.models.map(({ reference: _, ...model }) => model),
    })
  }
  if (selection.global.includes('parameters')) await snapshot('momo-web-parameters', readParameters())
  if (selection.global.includes('preferences')) await snapshot('momo-web-preferences', portablePreferences(preferences))
  if (selection.personal_spaces.length) {
    const data = spacesHost().read()
    await snapshot('momo-web-personal-spaces', {
      revision: data.revision,
      spaces: data.spaces.filter((space) => selection.personal_spaces.includes(space.id)),
    })
  }
  if (selection.prompts.length) {
    const entries = promptSpaces(await (await core().request('/v1/prompt-spaces')).json())
    if (selection.prompts.some((id) => !entries.some((p) => p.id === id))) throw Error('提示词空间不可用')
    const overrides = entries.filter((p) => p.source === 'override' && selection.prompts.includes(p.id))
    if (overrides.length) await snapshot('momo-web-prompts', overrides)
  }
  const settings = new Map<string, Record<string, unknown>>()
  for (const space of new Set(
    Object.entries(selection.spaces)
      .filter(([key]) => key !== 'state_contract')
      .flatMap(([, ids]) => ids ?? [])
  )) {
    settings.set(
      space,
      record(await (await core(space).request(`/v1/runtime-settings/metadata?space_id=${space}`)).json())
    )
  }
  for (const [key, spaces] of Object.entries(selection.spaces) as [SpaceConfig, string[]][]) {
    if (!spaces.length) continue
    const values = []
    for (const space_id of spaces) {
      if (key === 'state_contract') {
        const raw = record(await (await core(space_id).request(`/v1/mo-state/contract?space_id=${space_id}`)).json())
        values.push({
          space_id,
          content: text(raw.content, 'content'),
          revision: text(raw.revision, 'revision'),
          source: raw.source,
        })
      } else {
        const resource = settings.get(space_id)!
        const raw = record(resource.settings)
        let value = raw[key]
        if (key === 'memory_lifecycle') value = record(raw.mo_state).memory_lifecycle
        if (key === 'mo_state') {
          const { memory_lifecycle: _, ...state } = record(raw.mo_state)
          value = state
        }
        const prefix = key === 'memory_lifecycle' ? 'mo_state.memory_lifecycle' : key
        const sources = Object.fromEntries(
          Object.entries(record(resource.sources)).filter(
            ([path]) =>
              (path === prefix || path.startsWith(prefix + '.')) &&
              (key !== 'mo_state' || !path.startsWith('mo_state.memory_lifecycle.'))
          )
        )
        values.push({ space_id, revision: resource.revision, settings: value, sources })
      }
    }
    await snapshot('momo-web-' + key.replaceAll('_', '-'), values)
  }
  return modules
}
