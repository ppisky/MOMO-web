import { character, conversation, list, message, record, text, uuid } from '../../contracts/core';
import { assets, receipt, type Removal } from '../../contracts/spaces';
import type { ResolvedParameters } from '../../contracts/parameters';
import { requestParameters } from '../../contracts/parameters';
import { stateManagement, managedDdm } from '../../contracts/mo-state';
import { coreIdentity, RESPONSE_SCHEMA } from '../../contracts/build';

type HostConfig = { coreOrigin: string; personalSpaceId: string; conversationSpaceId: string; applicationOrigin?: string };
type HostGlobal = typeof globalThis & {
  __MOMO_HOST_CONFIG?: HostConfig;
  process?: { env: Record<string, string | undefined> };
};

export function hostConfig(spaceId?: string): HostConfig {
  const host = globalThis as HostGlobal;
  const injected = host.__MOMO_HOST_CONFIG;
  const env = host.process?.env ?? {};
  const coreOrigin = injected?.coreOrigin ?? env.MOMO_CORE_ORIGIN ?? 'http://127.0.0.1:8765';
  const url = new URL(coreOrigin);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Core 地址必须是本机 loopback HTTP origin');
  return {
    coreOrigin: url.origin,
    personalSpaceId: uuid(spaceId ?? injected?.personalSpaceId ?? env.MOMO_PERSONAL_SPACE_ID),
    conversationSpaceId: uuid(spaceId ?? injected?.conversationSpaceId ?? env.MOMO_CONVERSATION_SPACE_ID),
  };
}

export class CoreError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? `Core 请求失败（${code}）`);
  }
}

export class CoreClient {
  constructor(
    public readonly config: HostConfig,
    private readonly transport: typeof fetch = fetch,
  ) {}

  async spaceAssets(id: string) {
    if (uuid(id) !== this.config.personalSpaceId) throw new CoreError(403, 'space_denied');
    const value = assets(await (await this.request(`/v1/spaces/${id}/assets`)).json());
    if (value.space_id !== id) throw new CoreError(502, 'space_response_mismatch');
    return value;
  }

  async removeSpace(request: Removal) {
    if (request.source_id !== this.config.personalSpaceId) throw new CoreError(403, 'space_denied');
    return receipt(
      await (
        await this.request(
          `/v1/spaces/${request.source_id}/remove`,
          { method: 'POST', body: JSON.stringify(request) },
          120000,
        )
      ).json(),
    );
  }

  async request(path: string, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = init.signal ? AbortSignal.any([timeout, init.signal]) : timeout
    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')
    let response: Response
    try {
      response = await this.transport(this.config.coreOrigin + path, { ...init, signal, redirect: 'error', headers })
    } catch {
      throw new CoreError(
        503,
        'core_unreachable',
        signal.aborted
          ? 'Core 请求超时或已取消，请检查运行状态。'
          : '无法连接 Core，请检查 Core 是否启动及应用连接地址。'
      )
    }
    if (!response.ok) {
      if (path.startsWith('/v1/mo-state/management?') && [404, 405].includes(response.status))
        throw new CoreError(409, 'core_version_mismatch', '当前 Core 缺少 MO State 管理接口，请更新与网页配套的 Core。');
      if (/^\/v1\/conversations\/[0-9a-f-]+\/archive$/.test(path) &&
          (response.status === 405 || (response.status === 404 && !response.headers.get('Content-Type')?.includes('application/json'))))
        throw new CoreError(409, 'core_version_mismatch', '当前 Core 缺少对话归档接口，请更新与网页配套的 Core。')
      if (path === '/v1/momo/model-requests/resolve' && [404, 405].includes(response.status))
        throw new CoreError(409, 'core_version_mismatch', '当前 Core 尚不支持用途推荐配置接口，请更新与网页配套的 Core。')
      if (
        (response.status === 404 || response.status === 405) &&
        (path.startsWith('/v1/memory/identity-binding') || path === '/v1/memory/assets/configure')
      )
        throw new CoreError(
          409,
          'core_version_mismatch',
          '当前运行的 Core 缺少资产配置接口，请切换到与网页配套的 Core 版本。'
        )
      if (response.status === 422) {
        const diagnostic = await response.clone().text()
        if (path === '/v1/semantic-graph/nodes/list' && diagnostic.includes('unknown field `include_archived`'))
          throw new CoreError(
            409,
            'core_version_mismatch',
            '当前运行的 Core 不支持含归档节点的语义网列表，请更新配套 Core。'
          )
        if (path === '/v1/model-configuration' && /invalid type: null.*expected (usize|u64)/s.test(diagnostic))
          throw new CoreError(409, 'core_version_mismatch', '当前运行的 Core 尚不支持留空上下文长度，请更新配套 Core。')
      }
      let code = `http_${response.status}`
      let purposeMessage: string | undefined
      try {
        const error = record(record(await response.json()).error)
        if (typeof error.code === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(error.code)) code = error.code
        if (path === '/v1/momo/model-requests/resolve' && typeof error.message === 'string') {
          const denied = /^request parameter "([a-zA-Z][a-zA-Z0-9_]{0,63})" is not allowed by policy$/.exec(error.message)
          if (denied) purposeMessage = `当前个人空间未允许参数 ${denied[1]}，请移除该参数或在本页明确允许。`
          else if (/^request override (temperature|max_output_tokens) is rejected by policy$/.test(error.message)) purposeMessage = '当前个人空间拒绝这项参数覆盖，请恢复默认或调整空间策略。'
          else if (/^request override max_output_tokens=\d+ must be between \d+ and \d+$/.test(error.message)) purposeMessage = '最大输出超出所选模型的预算范围，请降低该值。'
        }
      } catch {}
      throw new CoreError(response.status, code, purposeMessage)
    }
    return response
  }

  async health() {
    return (await this.healthInfo()).packageVersion;
  }

  async healthInfo() {
    const value = record(await (await this.request('/health')).json());
    if (value.ok !== true || value.service !== 'momo-server')
      throw new Error('目标不是可用的 MOMO Core 服务');
    return coreIdentity(value);
  }

  async moStateManagement() {
    const value: unknown = await (await this.request(`/v1/mo-state/management?space_id=${this.config.personalSpaceId}`)).json();
    stateManagement(value, this.config.personalSpaceId);
    return value;
  }

  async moStateDdm(id: string, reset = false) {
    const characterId = uuid(id);
    if (!(await this.characters()).some((role) => role.id === characterId))
      throw new CoreError(404, 'character_not_found');
    const value: unknown = await (await this.request(`/v1/mo-state/ddm-profile?space_id=${this.config.personalSpaceId}&character_id=${characterId}`, reset ? { method: 'DELETE' } : {})).json();
    if (reset) {
      if (record(value).ok !== true) throw new CoreError(502, 'ddm_reset_mismatch');
    } else managedDdm(value, characterId);
    return value;
  }

  async characters() {
    const values = list(
      await (await this.request(`/v1/characters?space_id=${this.config.personalSpaceId}`)).json(),
      character,
    );
    if (values.some((value) => value.owner_space_id !== this.config.personalSpaceId))
      throw new Error('Core 返回了授权范围外的角色');
    return values;
  }

  async conversations(archived?: boolean) {
    const values = list(
      await (
        await this.request(
          `/v1/conversations?space_id=${this.config.conversationSpaceId}${archived === undefined ? '' : `&archived=${archived}`}`,
        )
      ).json(),
      (value) => {
        if (!('archived_at' in record(value)))
          throw new CoreError(
            409,
            'core_version_mismatch',
            '当前 Core 缺少对话归档状态，请更新与网页配套的 Core。',
          );
        return conversation(value);
      },
    );
    if (values.some((value) => value.space_id !== this.config.conversationSpaceId))
      throw new Error('Core 返回了授权范围外的会话');
    if (archived !== undefined && values.some((value) => (value.archived_at !== null) !== archived))
      throw new CoreError(
        502,
        'conversation_archive_mismatch',
        'Core 返回了不符合归档筛选条件的对话。',
      );
    return values;
  }

  async archiveConversation(id: string, archived: boolean) {
    const expectedId = uuid(id);
    const result = conversation(
      await (
        await this.request(`/v1/conversations/${expectedId}/archive`, {
          method: 'POST',
          body: JSON.stringify({ space_id: this.config.conversationSpaceId, archived }),
        })
      ).json(),
    );
    if (
      result.id !== expectedId ||
      result.space_id !== this.config.conversationSpaceId ||
      (result.archived_at !== null) !== archived
    )
      throw new CoreError(502, 'conversation_archive_mismatch');
    return result;
  }

  async requireConversation(id: string) {
    if (!(await this.conversations()).some((value) => value.id === uuid(id)))
      throw new CoreError(404, 'conversation_not_found');
  }

  async messages(id: string) {
    await this.requireConversation(id);
    const values = list(
      await (
        await this.request(
          `/v1/conversations/${uuid(id)}/messages?space_id=${this.config.conversationSpaceId}`,
        )
      ).json(),
      message,
    );
    if (values.some((value) => value.conversation_id !== id)) throw new Error('Core 返回了其他会话的消息');
    return values;
  }

  async createCharacter(name: string, persona: string, fields: Record<string, string | null> = {}) {
    const created = character(
      await (
        await this.request('/v1/characters', {
          method: 'POST',
          body: JSON.stringify({
            owner_space_id: this.config.personalSpaceId,
            author_name: 'MOMO App',
            name,
            character_markdown: persona,
            user_markdown: '',
            ...fields,
          }),
        })
      ).json(),
    );
    if (created.owner_space_id !== this.config.personalSpaceId)
      throw new Error('Core 返回了授权范围外的角色');
    return created;
  }

  async createConversation(characterId: string | null) {
    const selected = characterId
      ? (await this.characters()).find((value) => value.id === uuid(characterId))
      : character(
          await (
            await this.request('/v1/memory/default-assistant', {
              method: 'POST',
              body: JSON.stringify({
                personal_space_id: this.config.personalSpaceId,
                name: 'MOMO',
                author_name: 'MOMO App',
              }),
            })
          ).json(),
        );
    if (characterId && !selected) throw new CoreError(404, 'character_not_found');
    const created = conversation(
      await (
        await this.request('/v1/conversations', {
          method: 'POST',
          body: JSON.stringify({
            space_id: this.config.conversationSpaceId,
            character_id: selected?.id ?? null,
            title: selected ? `与${selected.name}的对话` : '新对话',
          }),
        })
      ).json(),
    );
    if (
      created.space_id !== this.config.conversationSpaceId ||
      created.character_id !== (selected?.id ?? null)
    )
      throw new Error('Core 创建了范围外的会话');
    return created;
  }

  async respond(
    id: string,
    input: string,
    requestId: string,
    signal: AbortSignal,
    parameters?: ResolvedParameters,
  ) {
    uuid(requestId);
    await this.requireConversation(id);
    const memorySources =
      this.config.personalSpaceId === this.config.conversationSpaceId
        ? [
            {
              space_id: this.config.personalSpaceId,
              label: '当前空间',
              weight: 100,
              memory: true,
              semantic_graph: true,
            },
          ]
        : [
            {
              space_id: this.config.personalSpaceId,
              label: '个人空间',
              weight: 70,
              memory: true,
              semantic_graph: true,
            },
            {
              space_id: this.config.conversationSpaceId,
              label: '会话空间',
              weight: 30,
              memory: true,
              semantic_graph: true,
            },
          ];
    return this.request(
      '/v1/momo/responses',
      {
        method: 'POST',
        signal,
        body: JSON.stringify({
          model: parameters?.modelReference ?? 'conversation',
          input,
          stream: parameters?.stream ?? true,
          ...(parameters ? requestParameters(parameters) : {}),
          momo: {
            schema: RESPONSE_SCHEMA,
            request_id: requestId,
            conversation_id: id,
            personal_space_id: this.config.personalSpaceId,
            conversation_space_id: this.config.conversationSpaceId,
            memory_sources: memorySources,
            memory_write_space_id: this.config.personalSpaceId,
            mo_state: true,
            ...(parameters?.modelRoutes ? { model_routes: parameters.modelRoutes } : {}),
            ...(parameters?.embedding ? { embedding: parameters.embedding } : {}),
          },
        }),
      },
      300000,
    );
  }

  async cancel(requestId: string) {
    return this.request(`/v1/momo/responses/${encodeURIComponent(uuid(requestId))}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ personal_space_id: this.config.personalSpaceId }),
    });
  }
}
