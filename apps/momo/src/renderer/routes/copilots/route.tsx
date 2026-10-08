import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import Page from '@/components/layout/Page'
export const Route = createFileRoute('/copilots')({ component: RolesPage })
function RolesPage() {
  const { t } = useTranslation()
  return (
    <Page title={t('Roles')}>
      <Outlet />
    </Page>
  )
}
