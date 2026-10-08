import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/settings/knowledge-base')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/chat' })
  },
})
