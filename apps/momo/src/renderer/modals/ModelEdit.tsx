import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Stack, TextInput } from '@mantine/core'
import type { ProviderModelInfo } from '@shared/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'

const ModelEdit = NiceModal.create((props: { model?: ProviderModelInfo; providerId?: string }) => {
  const modal = useModal()
  const { t } = useTranslation()
  const [modelId, setModelId] = useState(props.model?.modelId || '')
  const [nickname, setNickname] = useState(props.model?.nickname || '')
  const close = () => {
    modal.resolve()
    modal.hide()
  }
  const save = () => {
    if (!modelId.trim()) return
    modal.resolve({ ...props.model, modelId: modelId.trim(), nickname: nickname.trim() || undefined, type: 'chat' })
    modal.hide()
  }
  return (
    <AdaptiveModal
      opened={modal.visible}
      onClose={close}
      title={t(props.model ? 'Edit Model' : 'Add model')}
      centered
      size="sm"
    >
      <Stack gap="md">
        <TextInput
          label={t('Model ID')}
          value={modelId}
          disabled={!!props.model}
          onChange={(e) => setModelId(e.currentTarget.value)}
          required
        />
        <TextInput
          label={t('Nickname')}
          placeholder={t('optional')}
          value={nickname}
          onChange={(e) => setNickname(e.currentTarget.value)}
        />
        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton onClick={close} />
          <Button onClick={save} disabled={!modelId.trim()}>
            {t('Save')}
          </Button>
        </AdaptiveModal.Actions>
      </Stack>
    </AdaptiveModal>
  )
})
export default ModelEdit
