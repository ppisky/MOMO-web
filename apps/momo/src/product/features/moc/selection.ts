import {
  configurationCount,
  globalConfigNames,
  spaceConfigNames,
  type ConfigurationSelection,
  type GlobalConfig,
  type SpaceConfig,
} from '../../contracts/moc'

export type ExportModule = 'conversations' | 'memory' | 'semantic_graph'
export type ExportGroup = 'characters' | 'conversations' | 'assets' | 'configuration'
export type SelectionState = 'none' | 'partial' | 'all'
export type ExportSelection = {
  characterSpaces: string[]
  allRoles: boolean
  selectedRoles: string[]
  scopes: Record<ExportModule, string[]>
  configuration: ConfigurationSelection
}

const globals = Object.keys(globalConfigNames) as GlobalConfig[]
const configs = Object.keys(spaceConfigNames) as SpaceConfig[]
const same = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id))

export function emptyExportSelection(): ExportSelection {
  return {
    characterSpaces: [],
    allRoles: true,
    selectedRoles: [],
    scopes: { conversations: [], memory: [], semantic_graph: [] },
    configuration: { global: [], prompts: [], personal_spaces: [], spaces: {} },
  }
}

export function selectionState(
  selection: ExportSelection,
  group: ExportGroup,
  range: string[],
  prompts: string[] = []
): SelectionState {
  const { characterSpaces, allRoles, scopes, configuration } = selection
  if (group === 'characters')
    return !characterSpaces.length ? 'none' : allRoles && same(characterSpaces, range) ? 'all' : 'partial'
  if (group === 'conversations')
    return !scopes.conversations.length ? 'none' : same(scopes.conversations, range) ? 'all' : 'partial'
  if (group === 'assets') {
    if (!scopes.memory.length && !scopes.semantic_graph.length) return 'none'
    return same(scopes.memory, range) && same(scopes.semantic_graph, range) ? 'all' : 'partial'
  }
  if (!configurationCount(configuration)) return 'none'
  return same(configuration.global, globals) &&
    same(configuration.prompts, prompts) &&
    same(configuration.personal_spaces, range) &&
    configs.every((key) => same(configuration.spaces[key] ?? [], range))
    ? 'all'
    : 'partial'
}

/** Quick choices update the same selection used by detailed controls and the wire plan. */
export function chooseGroup(
  selection: ExportSelection,
  group: ExportGroup,
  enabled: boolean,
  range: string[],
  prompts: string[] = []
): ExportSelection {
  const spaces = enabled ? [...range] : []
  if (group === 'characters') return { ...selection, characterSpaces: spaces, allRoles: true, selectedRoles: [] }
  if (group === 'conversations') return { ...selection, scopes: { ...selection.scopes, conversations: spaces } }
  if (group === 'assets')
    return { ...selection, scopes: { ...selection.scopes, memory: spaces, semantic_graph: spaces } }
  return {
    ...selection,
    configuration: enabled
      ? {
          global: [...globals],
          prompts: [...prompts],
          personal_spaces: spaces,
          spaces: Object.fromEntries(configs.map((key) => [key, [...spaces]])),
        }
      : emptyExportSelection().configuration,
  }
}

/** An explicit range change moves selected space components; it never enables an omitted component. */
export function changeQuickRange(selection: ExportSelection, previous: string[], next: string[]): ExportSelection {
  if (same(previous, next)) return selection
  const move = (spaces: string[]) => (spaces.length ? [...next] : [])
  const characterSpaces = move(selection.characterSpaces)
  return {
    ...selection,
    characterSpaces,
    selectedRoles: same(characterSpaces, selection.characterSpaces) ? selection.selectedRoles : [],
    scopes: {
      conversations: move(selection.scopes.conversations),
      memory: move(selection.scopes.memory),
      semantic_graph: move(selection.scopes.semantic_graph),
    },
    configuration: {
      ...selection.configuration,
      personal_spaces: move(selection.configuration.personal_spaces),
      spaces: Object.fromEntries(
        Object.entries(selection.configuration.spaces).map(([key, ids]) => [key, move(ids ?? [])])
      ),
    },
  }
}
