import { Button, Combobox, ScrollArea, Text, useCombobox } from '@mantine/core'
import { TestId } from '@shared/automation/testids'
import { cloneElement, forwardRef, isValidElement, type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProviders } from '@/hooks/useProviders'
import { navigateToSettings } from '@/modals/settings-navigation'
import { filterModelsForSelector } from '../ModelSelector/filterModels'
import type { ModelSelectorV2Props } from './types'

export const ModelSelectorV2 = forwardRef<HTMLDivElement, ModelSelectorV2Props>(
  (
    {
      children,
      showAuto,
      autoText,
      onSelect,
      onDropdownOpen,
      modelFilter,
      modelDisabledCheck,
      selectedProviderId,
      selectedModelId,
      searchPosition: _searchPosition,
      pageName: _pageName,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation()
    const { providers } = useProviders()
    const [search, setSearch] = useState('')
    const combobox = useCombobox({
      onDropdownOpen,
      onDropdownClose: () => {
        setSearch('')
        combobox.resetSelectedOption()
      },
    })
    const rows = providers
      .flatMap((provider) =>
        (filterModelsForSelector(provider.models || [], modelFilter, provider.id) || []).map((model) => ({
          provider,
          model,
        }))
      )
      .filter(({ provider, model }) =>
        `${provider.name} ${model.modelId} ${model.nickname ?? ''}`.toLowerCase().includes(search.toLowerCase())
      )
    return (
      <Combobox
        {...props}
        store={combobox}
        transitionProps={{ duration: 0 }}
        onOptionSubmit={(value) => {
          if (value === 'auto') onSelect?.('', '')
          else {
            const row = rows.find((item) => JSON.stringify([item.provider.id, item.model.modelId]) === value)
            if (row) onSelect?.(row.provider.id, row.model.modelId)
          }
          combobox.closeDropdown()
        }}
      >
        <Combobox.Target>
          {isValidElement(children) ? (
            cloneElement(children as ReactElement<{ onClick(): void }>, { onClick: () => combobox.toggleDropdown() })
          ) : (
            <button type="button" onClick={() => combobox.toggleDropdown()}>
              {t('Select model')}
            </button>
          )}
        </Combobox.Target>
        <Combobox.Dropdown ref={ref} data-testid={TestId.model.selectorPanel}>
          <Combobox.Search
            data-testid={TestId.model.searchInput}
            placeholder={t('Search models')}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <ScrollArea.Autosize mah={360}>
            <Combobox.Options>
              {showAuto && <Combobox.Option value="auto">{autoText || t('Auto')}</Combobox.Option>}
              {rows.map(({ provider, model }) => {
                const reason = modelDisabledCheck?.(model, provider.id)
                return (
                  <Combobox.Option
                    key={JSON.stringify([provider.id, model.modelId])}
                    value={JSON.stringify([provider.id, model.modelId])}
                    disabled={Boolean(reason)}
                    active={provider.id === selectedProviderId && model.modelId === selectedModelId}
                  >
                    <Text size="sm">{model.nickname || model.modelId}</Text>
                    <Text size="xs" c="chatbox-tertiary">
                      {reason || provider.name}
                    </Text>
                  </Combobox.Option>
                )
              })}
              {!rows.length && <Combobox.Empty>{t('No models available yet')}</Combobox.Empty>}
            </Combobox.Options>
          </ScrollArea.Autosize>
          <Button
            fullWidth
            variant="subtle"
            size="xs"
            mt="xs"
            onClick={() => {
              combobox.closeDropdown()
              navigateToSettings('/provider')
            }}
          >
            {t('Configure models')}
          </Button>
        </Combobox.Dropdown>
      </Combobox>
    )
  }
)
export default ModelSelectorV2
