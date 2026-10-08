import { createFileRoute, Navigate } from '@tanstack/react-router'
export const Route = createFileRoute('/settings/default-models')({ component: RouteComponent })
export function RouteComponent() {
  return <Navigate to="/settings/model-parameters" replace />
}
