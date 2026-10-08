import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/settings/web-search')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/provider' })
  },
})
