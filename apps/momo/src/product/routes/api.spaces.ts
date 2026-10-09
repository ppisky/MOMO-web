import type { ActionFunctionArgs, LoaderFunctionArgs } from '../lib/server/handler-types';
import { uuid, text } from '../contracts/core';
import { disposition } from '../contracts/spaces';
import { actionInput, actionError } from '../lib/server/actions.server';
import { spacesHost } from '../lib/server/spaces.server';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    if (!['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)) throw new Error('本机访问地址无效');
    const id = url.searchParams.get('inventory');
    return Response.json(id ? await spacesHost().inventory(uuid(id)) : spacesHost().read(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return actionError(error); }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const data = await actionInput(request); const host = spacesHost();
    if (data.command === 'resume') return Response.json(await host.resume());
    if (typeof data.revision !== 'number' || !Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error('空间版本无效');
    const version = data.revision;
    switch (data.command) {
      case 'create': return Response.json(host.create(version, data.name));
      case 'rename': return Response.json(host.rename(version, uuid(data.id), data.name));
      case 'select': return Response.json(host.select(version, uuid(data.id)));
      case 'remove': return Response.json(await host.remove(version, uuid(data.id), text(data.assetRevision, 'assetRevision'), disposition(data.disposition)));
      default: throw new Error('未知空间操作');
    }
  } catch (error) { return actionError(error); }
}
