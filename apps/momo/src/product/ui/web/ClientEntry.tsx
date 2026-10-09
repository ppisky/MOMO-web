import React from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';
const WebApp = lazy(() => import('./WebApp'));
export function ClientEntry() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? (
    <Suspense fallback={<div role="status">正在载入 MOMO…</div>}>
      <WebApp />
    </Suspense>
  ) : (
    <div role="status">正在载入 MOMO…</div>
  );
}
