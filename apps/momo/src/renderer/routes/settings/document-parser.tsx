import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/settings/document-parser')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/chat' })
  },
})
