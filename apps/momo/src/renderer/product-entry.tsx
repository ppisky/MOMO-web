import { MantineProvider } from '@mantine/core'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createWebTheme } from '../product/ui/web/theme'
import WebApp from '../product/ui/web/WebApp'
import '@mantine/core/styles.css'
import '../product/ui/web/tokens.css'
import '../product/ui/web/original.css'
import '../product/ui/web/Block.css'
import '../product/ui/web/settings.css'

function ProductEntry() {
  useEffect(() => {
    document.querySelector('.splash-screen')?.remove()
  }, [])
  return (
    <MantineProvider theme={createWebTheme()} defaultColorScheme="auto">
      <WebApp />
    </MantineProvider>
  )
}
const container = document.getElementById('root')
if (!container) throw new Error('Missing application root')
createRoot(container).render(<ProductEntry />)
