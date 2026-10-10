import { Badge, Box, Button, Flex, Text } from '@mantine/core'
import { createRoot } from 'react-dom/client'
import { ModelParameters } from '../../src/product/ui/web/CoreSettings'
import { Product, type ProductContext } from '../../src/product/ui/web/context'
import { addToast, Notices } from '../../src/product/ui/web/media'
import { WebProviders } from '../../src/product/ui/web/store'
import { demoSpaceId, resetDemo } from './api'
import '@mantine/core/styles.css'
import '../../src/product/ui/web/tokens.css'
import '../../src/product/ui/web/original.css'
import './style.css'

const onlyParameters = () => addToast('演示已预置文本、视觉和向量化模型，可在下面直接选择。')
const context: ProductContext = {
  data: {
    spaceId: demoSpaceId,
    version: 'demo',
    characters: [],
    conversations: [],
    selected: null,
    history: [],
    spaces: { revision: 0, currentId: demoSpaceId, spaces: [{ id: demoSpaceId, name: '演示个人空间' }], pending: null },
  },
  path: '/settings/model-parameters',
  navigate: onlyParameters,
  reload: () => {},
  openSettings: onlyParameters,
  selectedRole: null,
  selectRole: () => {},
  openSearch: onlyParameters,
}
function Demo() {
  return (
    <WebProviders>
      <header className="demo-header">
        <Flex gap="sm" align="center">
          <Text fw={700}>MOMO</Text>
          <Badge variant="light">模型参数演示</Badge>
        </Flex>
        <Button variant="subtle" size="xs" onClick={resetDemo}>
          重置演示
        </Button>
      </header>
      <main className="demo-main">
        <Box maw={680} mx="auto">
          <Text size="sm" c="dimmed" px="md" pt="xl" pb="xs">
            三类模型已备好，直接体验选择与配置。修改只保存在此演示中，不会发送模型请求。
          </Text>
          <Product.Provider value={context}>
            <ModelParameters />
          </Product.Provider>
        </Box>
      </main>
      <Notices />
    </WebProviders>
  )
}
const root = document.getElementById('root')
if (!root) throw Error('Missing demo root')
createRoot(root).render(<Demo />)
