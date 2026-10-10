import React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { Alert, Box, Button, Loader, Stack, Text, Title } from '@mantine/core';
import { WebProviders, DraftProvider, useIsSmallScreen, useSettingsStore, useUIStore } from './store';
import Sidebar from './Sidebar';
import { Product } from './context';
import { api, workspace, type Workspace } from './api';
import { Home } from './Home';
import { Roles } from './Roles';
import { Assets } from './Assets';
import { ProductSettings } from './ProductSettings';
import { SearchChats } from './Sessions';
import { Notices, addToast } from './media';
import { conversation } from '../../contracts/core';
import { directory } from '../../contracts/spaces';
import { Chat } from '../../features/chat/Chat';
import Page from './Page';

const rootRoute = createRootRoute({ component: ProductRoot });
const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '$' }),
  createRoute({ getParentRoute: () => rootRoute, path: '/' }),
]);
const router = createRouter({ routeTree });
export default function WebApp() {
  return (
    <WebProviders>
      <RouterProvider router={router} />
      <Notices />
    </WebProviders>
  );
}
function ProductRoot() {
  const routerNavigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(false);
  const [selectedRole, selectRole] = useState<string | null>(null);
  const [first, setFirst] = useState<{ id: string; input: string; requestId: string } | null>(null);
  const [runningConversationId, setConversationRunning] = useState<string | null>(null);
  const previous = useRef('/');
  const small = useIsSmallScreen();
  const ui = useUIStore((s) => s);
  const preferences = useSettingsStore((s) => s);
  const selectedId = path.startsWith('/session/')
    ? path.split('/')[2]
    : path.startsWith('/settings/')
      ? data?.selected?.id
      : undefined;
  const navigate = (to: string) => {
    void routerNavigate({ to });
  };
  const reload = () => setRevision((v) => v + 1);
  const openSettings = (page = 'provider') => {
    if (!path.startsWith('/settings')) previous.current = path;
    navigate(`/settings/${page}`);
  };
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError('');
    void api('/api/workspace' + (selectedId ? `?conversation=${selectedId}` : ''), undefined, abort.signal)
      .then((v) => setData(workspace(v)))
      .catch(async (e) => {
        if (abort.signal.aborted) return;
        setError(e.message);
        try {
          const spaces = directory(await api('/api/spaces', undefined, abort.signal));
          setData({
            spaces,
            spaceId: spaces.currentId,
            version: '',
            characters: [],
            conversations: [],
            selected: null,
            history: [],
          });
        } catch {
          setData(null);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [selectedId, revision]);
  useEffect(() => {
    if (path.startsWith('/session/')) localStorage.setItem('momo-app.last-session', path);
  }, [path]);
  useEffect(() => {
    selectRole(null);
  }, [data?.spaceId]);
  useEffect(() => {
    if (path === '/' && preferences.startupPage === 'session') {
      const last = localStorage.getItem('momo-app.last-session');
      if (last && /^\/session\/[\da-f-]{36}$/.test(last)) navigate(last);
    }
  }, []);
  if (!data)
    return (
      <Stack h="100dvh" align="center" justify="center" data-momo-state={error ? 'error' : 'loading'} data-momo-error={error || undefined}>
        <Loader size="sm" />
        {error && (
          <>
            <Text>{error}</Text>
            <Button id="momo-startup-retry" onClick={reload}>重试</Button>
          </>
        )}
      </Stack>
    );
  async function start(input: string) {
    if (!data) return;
    const created = conversation(
      await api('/api/conversations', { spaceId: data.spaceId, characterId: selectedRole }),
    );
    if (preferences.autoGenerateTitle)
      await api('/api/resources', {
        command: 'conversation-rename',
        spaceId: data.spaceId,
        id: created.id,
        title: input.slice(0, 40),
      }).catch(() => addToast('对话已创建，自动标题未保存，可稍后重命名。'));
    setFirst({ id: created.id, input, requestId: crypto.randomUUID() });
    navigate(`/session/${created.id}`);
  }
  const requestedSettings = path === '/settings' ? 'provider' : path.startsWith('/settings/') ? path.split('/')[2] : null;
  const settingsPage = requestedSettings === 'hotkeys' ? 'chat' : requestedSettings;
  const contentPath = settingsPage ? previous.current : path;
  const role = data.characters.find((r) => r.id === data.selected?.character_id);
  const content =
    contentPath.startsWith('/session/') && data.selected?.id !== selectedId ? (
      <Stack h="100%" align="center" justify="center">
        {loading ? (
          <Loader size="sm" />
        ) : (
          <>
            <Text c="chatbox-secondary">当前空间中找不到这段对话。</Text>
            <Button variant="light" onClick={() => navigate('/')}>
              返回首页
            </Button>
          </>
        )}
      </Stack>
    ) : contentPath === '/copilots' ? (
      <Roles />
    ) : contentPath === '/memory' ? (
      <Assets />
    ) : contentPath === '/nsg' ? (
      <Assets graph />
    ) : contentPath === '/about' ? (
      <Page title="关于 MOMO">
        <Stack p="xl" gap="md">
          <Title order={3}>MOMO</Title>
          <Text c="chatbox-secondary">角色与故事，属于你的空间。</Text>
          <Text size="sm" c="chatbox-tertiary">
            界面来自 MOMO-web · GPL-3.0
          </Text>
        </Stack>
      </Page>
    ) : contentPath.startsWith('/session/') && data.selected ? (
      <Page title={data.selected.title}>
        <Chat
          key={data.spaceId + data.selected.id}
          spaceId={data.spaceId}
          conversationId={data.selected.id}
          history={data.history}
          characterName={role?.name ?? 'MOMO'}
          reload={reload}
          initialInput={first?.id === data.selected.id ? first : undefined}
          onConsumed={() => setFirst(null)}
        />
      </Page>
    ) : (
      <DraftProvider key={data.spaceId} value={data.spaceId + ':new'}>
        <Home onSubmit={start} />
      </DraftProvider>
    );
  return (
    <Product.Provider
      value={{
        data,
        path,
        navigate,
        reload,
        openSettings,
        selectedRole,
        selectRole,
        openSearch: () => setSearch(true),
        runningConversationId,
        setConversationRunning,
      }}
    >
      <Box id={error ? "momo-product-degraded" : "momo-product-ready"} className="momo-product" h="100dvh" style={{ overflow: 'hidden' }} data-momo-state={error ? 'degraded' : 'ready'} data-momo-error={error || undefined}>
        <Sidebar />
        <Box
          h="100%"
          style={{
            marginLeft: !small && ui.showSidebar ? ui.sidebarWidth : 0,
            padding: small ? 0 : ui.showSidebar ? '10px 10px 10px 0' : '5px',
            transition: 'margin-left 150ms ease',
            minWidth: 0,
          }}
        >
          <Box
            h="100%"
            className="overflow-hidden border-[0.5px] border-solid border-chatbox-border-primary bg-chatbox-background-primary"
            style={{ borderRadius: small ? 0 : 16 }}
          >
            {error && (
              <Alert color="red" p="xs" title="连接未完成" onClose={() => setError('')} withCloseButton>
                {error}
              </Alert>
            )}
            {content}
          </Box>
        </Box>
        {settingsPage && (
          <ProductSettings
            page={settingsPage}
            onClose={() => {
              navigate(previous.current);
              reload();
            }}
          />
        )}
        <SearchChats opened={search} close={() => setSearch(false)} />
      </Box>
    </Product.Provider>
  );
}
