import React, { useEffect, useState } from 'react';
import { Avatar, Image, ActionIcon, Notification } from '@mantine/core';
import { IconInfoCircle, IconUser } from '@tabler/icons-react';
export function addToast(message: string) {
  window.dispatchEvent(new CustomEvent('momo-notice', { detail: message }));
}
export function Notices() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const listener = (e: Event) => {
      if (e instanceof CustomEvent && typeof e.detail === 'string') setMessage(e.detail);
    };
    window.addEventListener('momo-notice', listener);
    return () => window.removeEventListener('momo-notice', listener);
  }, []);
  return message ? (
    <Notification
      style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 4000, maxWidth: 420 }}
      onClose={() => setMessage('')}
    >
      {message}
    </Notification>
  ) : null;
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('momo-app-ui-assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function handleImageInputAndSave(
  file: File,
  key: string,
  done: () => void,
  _oldAdapter: (key: string, blob: Blob) => Promise<void>,
) {
  try {
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024)
      throw Error('请选择 5 MB 以下的 JPG 或 PNG 图片。');
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.objectStore('images').put(file, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    done();
  } catch (error) {
    addToast(error instanceof Error ? error.message : '图片保存失败');
  }
}
export function useImage(key?: string) {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let active = true;
    let resource: string | undefined;
    setUrl(undefined);
    if (key)
      void database()
        .then(
          (db) =>
            new Promise<unknown>((resolve, reject) => {
              const request = db.transaction('images').objectStore('images').get(key);
              request.onsuccess = () => {
                resolve(request.result);
                db.close();
              };
              request.onerror = () => {
                reject(request.error);
                db.close();
              };
            }),
        )
        .then((blob) => {
          if (active && blob instanceof Blob) {
            resource = URL.createObjectURL(blob);
            setUrl(resource);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      if (resource) URL.revokeObjectURL(resource);
    };
  }, [key]);
  return url;
}
export function ImageInStorage({ storageKey, className }: { storageKey: string; className?: string }) {
  const src = useImage(storageKey);
  return <Image src={src} {...(className ? { className } : {})} alt="" />;
}
export function UserAvatar({ avatarKey, size }: { avatarKey?: string | undefined; size: number }) {
  return (
    <Avatar size={size} radius="lg" src={useImage(avatarKey) ?? null}>
      <IconUser size={size / 2} />
    </Avatar>
  );
}
export function AssistantAvatar({ avatarKey, size }: { avatarKey?: string | undefined; size: number }) {
  return <Avatar size={size} radius="lg" src={useImage(avatarKey) ?? '/momo.svg'} />;
}
export const TooltipInfoTrigger = React.forwardRef<HTMLButtonElement, { label: string }>(
  ({ label, ...props }, ref) => (
    <ActionIcon ref={ref} variant="transparent" aria-label={label} {...props}>
      <IconInfoCircle size={16} />
    </ActionIcon>
  ),
);
