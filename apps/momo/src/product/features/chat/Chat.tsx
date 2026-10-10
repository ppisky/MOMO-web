import { request as fetch } from '../../lib/transport';
import React, { useEffect, useRef, useState } from 'react';
import { ActionIcon, Alert, Box, Button, Flex, Stack, Text, Tooltip } from '@mantine/core';
import { IconCopy, IconQuote } from '@tabler/icons-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import InputBox from '../../ui/web/InputBox';
import { DraftProvider, useSettingsStore } from '../../ui/web/store';
import { AssistantAvatar, UserAvatar, useImage, addToast } from '../../ui/web/media';
import { useProduct } from '../../ui/web/context';

import { record, type Message } from '../../contracts/core';
import { initialProjection, projectEvent, readEvents } from './stream';

type Props = {
  spaceId: string;
  conversationId: string;
  history: Message[];
  characterName: string;
  reload: () => void;
  initialInput?: { input: string; requestId: string } | undefined;
  onConsumed?: () => void;
};
type ViewMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  status?: { type: string; reason?: string };
  latency?: number;
  model?: string;
  tokens?: number;
};

async function post(path: string, input: unknown, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`);
  return response;
}

export function Chat(props: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready ? (
    <ChatSession key={props.conversationId} {...props} />
  ) : (
    <div className="thread-empty" role="status">
      正在载入对话…
    </div>
  );
}

function ChatSession({
  spaceId,
  conversationId,
  history,
  characterName,
  reload,
  initialInput,
  onConsumed,
}: Props) {
  const settings = useSettingsStore((s) => s);
  const { openSettings } = useProduct();
  const background = useImage(settings.backgroundImageKey);
  const viewport = useRef<HTMLDivElement>(null);
  const consumed = useRef(false);
  const [messages, setMessages] = useState<ViewMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<{ requestId: string; controller: AbortController; generation: number } | null>(null);
  const generation = useRef(0);
  const retry = useRef<{ requestId: string; input: string } | null>(null);

  useEffect(() => {
    generation.current++;
    return () => {
      generation.current++;
      const running = active.current;
      if (running) {
        void post('/api/cancel', { spaceId, requestId: running.requestId }).catch(() => {});
        running.controller.abort();
        active.current = null;
      }
    };
  }, [spaceId, conversationId]);
  useEffect(() => {
    if (active.current) return;
    setMessages(
      history.map((value) => ({
        id: value.id,
        role: value.role,
        content: value.content,
        createdAt: new Date(value.created_at),
      })),
    );
    setIsRunning(false);
    setError(null);
    retry.current = null;
  }, [history]);

  const send = async (input: string, requestId: string = crypto.randomUUID()) => {
    if (active.current) return;
    const run = { requestId, controller: new AbortController(), generation: generation.current };
    active.current = run;
    retry.current = { input, requestId };
    const userId = `pending-user:${requestId}`;
    const assistantId = `pending-assistant:${requestId}`;
    setMessages((values) => [
      ...values.filter((value) => value.id !== userId && value.id !== assistantId),
      { id: userId, role: 'user', content: input, createdAt: new Date() },
      { id: assistantId, role: 'assistant', content: '', createdAt: new Date(), status: { type: 'running' } },
    ]);
    setIsRunning(true);
    setError(null);
    let state = initialProjection(requestId);
    const started = performance.now();
    let firstToken: number | undefined;
    try {
      const response = await post(
        '/api/chat',
        { spaceId, conversationId, input, requestId, stream: settings.stream },
        run.controller.signal,
      );
      if (!response.body || !response.headers.get('Content-Type')?.includes('text/event-stream'))
        throw new Error('未收到流式响应');
      for await (const event of readEvents(response.body)) {
        if (generation.current !== run.generation) return;
        state = projectEvent(state, event);
        if (state.text && firstToken === undefined) firstToken = performance.now() - started;
        const responseData =
          event.data.response && typeof event.data.response === 'object' ? record(event.data.response) : null;
        const usage =
          responseData?.usage && typeof responseData.usage === 'object' ? record(responseData.usage) : null;
        setMessages((values) =>
          values.map((value) =>
            value.id === assistantId
              ? {
                  ...value,
                  content: state.text,
                  ...(firstToken === undefined ? {} : { latency: firstToken }),
                  ...(typeof responseData?.model === 'string' ? { model: responseData.model } : {}),
                  ...(typeof usage?.total_tokens === 'number' ? { tokens: usage.total_tokens } : {}),
                }
              : value,
          ),
        );
        if (state.terminal) break;
      }
      if (state.terminal !== 'completed')
        throw new Error(
          state.terminal === 'failed'
            ? '生成失败，请检查模型设置'
            : state.terminal === 'cancelled'
              ? 'Core 已确认取消。请刷新历史确认已保存的消息。'
              : '连接中断，结果需要确认',
        );
      retry.current = null;
      if (generation.current === run.generation) reload();
    } catch (cause) {
      if (generation.current !== run.generation) return;
      const message =
        run.controller.signal.aborted && state.terminal !== 'cancelled'
          ? '已停止接收。请刷新历史确认最终结果。'
          : cause instanceof Error
            ? cause.message
            : '生成未能完成';
      setError(message);
    } finally {
      if (generation.current === run.generation) {
        setMessages((values) =>
          values.map((value) =>
            value.id === assistantId
              ? {
                  ...value,
                  status:
                    state.terminal === 'completed'
                      ? { type: 'complete', reason: 'stop' }
                      : { type: 'incomplete', reason: 'error' },
                }
              : value,
          ),
        );
        setIsRunning(false);
        if (active.current === run) active.current = null;
      }
    }
  };

  const onCancel = async () => {
    const running = active.current;
    if (!running) return;
    try {
      await post('/api/cancel', { spaceId, requestId: running.requestId });
    } catch {
      setError('停止请求未获确认，请刷新历史检查结果。');
    } finally {
      running.controller.abort();
    }
  };

  useEffect(() => {
    if (initialInput && !consumed.current) {
      consumed.current = true;
      void send(initialInput.input, initialInput.requestId);
      onConsumed?.();
    }
  }, [initialInput]);
  useEffect(() => {
    const view = viewport.current;
    if (!view) return;
    if (settings.autoScrollNewMessagesToTop) {
      const lastUser = view.querySelector('[data-last-user="true"]');
      if (lastUser instanceof HTMLElement) view.scrollTop = Math.max(0, lastUser.offsetTop - 16);
    } else view.scrollTop = view.scrollHeight;
  }, [messages, settings.autoScrollNewMessagesToTop]);

  return (
    <Stack h="100%" gap={0} className="relative min-h-0">
      {background && (
        <Box
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'url(' + JSON.stringify(background) + ')',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            opacity: settings.backgroundImageOpacity,
          }}
        />
      )}
      <Box ref={viewport} className="flex-1 min-h-0 overflow-y-auto relative" px="md" py="lg">
        <Stack gap="lg" className="max-w-4xl mx-auto">
          {!messages.length && (
            <Stack align="center" justify="center" py={80} gap="sm">
              <AssistantAvatar size={48} avatarKey={settings.defaultAssistantAvatarKey} />
              <Text fw={600}>{characterName}</Text>
              <Text size="sm" c="chatbox-tertiary">
                写下对白，或用 *动作* 描述你的回应。
              </Text>
            </Stack>
          )}
          {messages
            .filter((m) => !(m.role === 'system' && settings.hideSystemPromptMessage))
            .map((message) => {
              const right = settings.messageLayout === 'bubble' && message.role === 'user';
              return (
                <Flex
                  key={message.id}
                  data-last-user={
                    message.role === 'user' &&
                    message.id === messages.filter((m) => m.role === 'user').at(-1)?.id
                      ? 'true'
                      : undefined
                  }
                  gap="sm"
                  align="flex-start"
                  direction={right ? 'row-reverse' : 'row'}
                  className={`group/message msg-block ${right ? 'bubble-user-msg' : ''}`}
                >
                  {settings.showAvatar &&
                    (message.role === 'user' ? (
                      <UserAvatar size={32} avatarKey={settings.userAvatarKey} />
                    ) : (
                      <AssistantAvatar size={32} avatarKey={settings.defaultAssistantAvatarKey} />
                    ))}
                  <Stack
                    gap={4}
                    align={right ? 'flex-end' : 'flex-start'}
                    className="min-w-0 max-w-full"
                    style={{ maxWidth: settings.messageLayout === 'bubble' ? '85%' : '100%' }}
                  >
                    <Text size="xs" c="chatbox-tertiary">
                      {message.role === 'user' ? '你' : characterName}
                    </Text>
                    <Box
                      className={
                        settings.messageLayout === 'bubble'
                          ? 'inline-block max-w-full min-w-0 px-4 py-1 rounded-lg ' +
                            (right
                              ? 'bg-[var(--mantine-color-chatbox-brand-filled)] text-white'
                              : 'bg-chatbox-background-secondary')
                          : message.role === 'user'
                            ? 'bg-chatbox-background-secondary px-4 rounded-lg'
                            : 'w-full min-w-0'
                      }
                    >
                      <div className="msg-content">
                        {settings.enableMarkdownRendering ? (
                          <Markdown remarkPlugins={[remarkGfm]}>
                            {message.content || (message.status?.type === 'running' ? '…' : '')}
                          </Markdown>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    </Box>
                    <Flex gap={4} align="center">
                      {settings.showMessageTimestamp && (
                        <Text size="xs" c="chatbox-tertiary">
                          {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                      {settings.showWordCount && (
                        <Text size="xs" c="chatbox-tertiary">
                          {Array.from(message.content).length} 字
                        </Text>
                      )}
                      {settings.showModelName && message.role === 'assistant' && (
                        <Text size="xs" c="chatbox-tertiary">
                          {message.model ?? '模型信息未提供'}
                        </Text>
                      )}
                      {settings.showTokenUsed && message.role === 'assistant' && (
                        <Text size="xs" c="chatbox-tertiary">
                          {message.tokens === undefined ? 'Token 用量未提供' : `${message.tokens} tokens`}
                        </Text>
                      )}
                      {settings.showFirstTokenLatency && message.role === 'assistant' && (
                        <Text size="xs" c="chatbox-tertiary">
                          {message.latency === undefined
                            ? '首字耗时未提供'
                            : `${(message.latency / 1000).toFixed(2)} s`}
                        </Text>
                      )}
                      <Tooltip label="复制">
                        <ActionIcon
                          aria-label="复制消息"
                          size="xs"
                          variant="subtle"
                          color="chatbox-tertiary"
                          className="opacity-0 group-hover/message:opacity-100 focus:opacity-100"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(message.content)
                              .catch(() => addToast('复制失败'))
                          }
                        >
                          <IconCopy size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Flex>
                  </Stack>
                </Flex>
              );
            })}
        </Stack>
      </Box>
      {error && (
        <Alert color="red" mx="md" mb="sm" title="回复尚未完成">
          <Text size="sm">{error}</Text>
          <Flex gap="xs" mt="xs">
            <Button size="xs" variant="light" onClick={reload}>
              刷新历史
            </Button>
            {retry.current && (
              <Button
                size="xs"
                variant="light"
                disabled={isRunning}
                onClick={() => {
                  const attempt = retry.current;
                  if (attempt) void send(attempt.input, attempt.requestId);
                }}
              >
                重试同一请求
              </Button>
            )}
          </Flex>
        </Alert>
      )}
      <DraftProvider value={spaceId + ':' + conversationId}>
        <InputBox
          onSubmit={async (input) => {
            if (!retry.current) await send(input);
          }}
          onSettings={() => openSettings('chat')}
          onStop={() => void onCancel()}
          running={isRunning}
          disabled={!!error}
        />
      </DraftProvider>
    </Stack>
  );
}
