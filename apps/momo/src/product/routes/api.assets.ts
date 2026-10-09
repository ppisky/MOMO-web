import type { ActionFunctionArgs } from '../lib/server/handler-types'
import { record, text, uuid } from '../contracts/core'
import { metadata, node, policy } from '../contracts/assets'
import { actionError, actionInput, core } from '../lib/server/actions.server'
import { CoreError } from '../lib/server/core.server'
export async function action({ request }: ActionFunctionArgs) {
  try {
    const input = await actionInput(request)
    const space = uuid(input.spaceId)
    const client = core(space)
    const revision = input.expected_revision
    if (revision !== null && (!Number.isSafeInteger(revision) || Number(revision) < 0)) throw Error('Invalid revision')
    const raw = record(input.content)
    const graph = raw.kind === 'semantic_graph'
    if (!graph && raw.kind !== 'memory') throw Error('Invalid asset kind')
    const content = graph
      ? { kind: 'semantic_graph', node: node(raw.node) }
      : { kind: 'memory', metadata: metadata(raw.metadata), body: text(raw.body, 'body') }
    const access = policy(input.policy)
    if (access.local_space_id !== space) throw new CoreError(403, 'space_mismatch')
    const roles = await client.characters()
    // Existing external readers remain valid; adding a reader requires a known local role.
    const ledger = record(
      record(await (await client.request(`/v1/memory/provenance?space_id=${space}&semantic_graph=${graph}`)).json())
        .ledger
    )
    const id = graph ? node(raw.node).id : metadata(raw.metadata).id
    const history = record(ledger.records)[id]
    const previous = history && record(history).policy ? policy(record(history).policy) : null
    if (access.personal_space_id !== space && access.personal_space_id !== previous?.personal_space_id)
      throw new CoreError(403, 'personal_space_mismatch')
    const known = new Set([
      ...roles.map((r) => r.id),
      ...(previous?.readers ?? []),
      ...(previous?.owner_character_id ? [previous.owner_character_id] : []),
    ])
    if ([access.owner_character_id, ...access.readers].some((id) => id && !known.has(id)))
      throw new CoreError(400, 'unknown_character')
    if (!graph) {
      const m = metadata(raw.metadata)
      if (m.injection_scope === 'conversation') {
        const conversation = (await client.conversations()).find((c) => c.id === m.injection_conversation_id)
        let preservedBinding = false
        if (!conversation && revision !== null) {
          const old = record(
            await (await client.request(`/v1/memory/documents/${encodeURIComponent(m.id)}?space_id=${space}`)).json()
          )
          const previousMetadata = metadata(old.metadata)
          preservedBinding =
            previousMetadata.injection_scope === 'conversation' &&
            previousMetadata.injection_conversation_id === m.injection_conversation_id &&
            previousMetadata.injection_character_id === m.injection_character_id
        }
        if (
          (!conversation && !preservedBinding) ||
          (conversation && conversation.character_id !== m.injection_character_id)
        )
          throw new CoreError(400, 'invalid_injection_conversation')
      } else if (m.injection_conversation_id !== null) throw new CoreError(400, 'stale_conversation_binding')
    }
    await client.request('/v1/memory/assets/configure', {
      method: 'PUT',
      body: JSON.stringify({ space_id: space, expected_revision: revision, content, policy: access }),
    })
    return Response.json({ ok: true })
  } catch (error) {
    return actionError(error)
  }
}
