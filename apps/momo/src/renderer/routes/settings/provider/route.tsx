import { Box, Flex } from '@mantine/core'
import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { AddProviderModal } from '@/components/settings/provider/AddProviderModal'
import { ProviderList } from '@/components/settings/provider/ProviderList'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { useSettingsStore } from '@/stores/settingsStore'
export const Route = createFileRoute('/settings/provider')({
  component: RouteComponent,
  validateSearch: zodValidator(z.object({ custom: z.boolean().optional() })),
})
export function RouteComponent() {
  const providers = useSettingsStore((s) => s.customProviders)
  const small = useIsSmallScreen()
  const { location } = useRouterState()
  const [opened, setOpened] = useState(false)
  const search = Route.useSearch()
  useEffect(() => {
    if (search.custom) setOpened(true)
  }, [search.custom])
  return (
    <Flex h="100%" w="100%">
      {(!small || location.pathname === '/settings/provider') && (
        <ProviderList providers={(providers || []).filter((p) => p.isCustom)} onAddProvider={() => setOpened(true)} />
      )}
      {!(small && location.pathname === '/settings/provider') && (
        <Box flex={1} p="md" className="overflow-auto">
          <Outlet />
        </Box>
      )}
      <AddProviderModal opened={opened} onClose={() => setOpened(false)} />
    </Flex>
  )
}
