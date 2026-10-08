import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/image-creator/')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})
