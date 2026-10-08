import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/settings/skills')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/chat' })
  },
})
