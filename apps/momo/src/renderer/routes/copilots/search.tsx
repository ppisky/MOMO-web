import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/copilots/search')({
  beforeLoad: () => {
    throw redirect({ to: '/copilots' })
  },
})
