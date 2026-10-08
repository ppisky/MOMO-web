import CustomClaude from '@shared/providers/definitions/models/custom-claude'
import CustomGemini from '@shared/providers/definitions/models/custom-gemini'
import CustomOpenAI from '@shared/providers/definitions/models/custom-openai'
import CustomOpenAIResponses from '@shared/providers/definitions/models/custom-openai-responses'
import {
  type ModelProvider,
  ModelProviderType,
  type ProviderBaseInfo,
  type ProviderModelInfo,
  type ProviderSettings,
  type SessionType,
} from '@shared/types'
import { createModelDependencies } from '@/adapters'
import BaseConfig from './base-config'
import type { ModelSettingUtil } from './interface'

/**
 * Unified setting util for all custom providers.
 * Handles OpenAI, Claude, Gemini, and OpenAIResponses custom provider types.
 */
export default class CustomProviderSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider
  private customProviderType: ModelProviderType

  constructor(provider: ModelProvider, customProviderType?: ModelProviderType) {
    super()
    this.provider = provider
    this.customProviderType = customProviderType || ModelProviderType.OpenAI
  }

  getCurrentModelDisplayName(
    model: string,
    _sessionType: SessionType,
    providerSettings?: ProviderSettings,
    providerBaseInfo?: ProviderBaseInfo
  ): Promise<string> {
    const providerName = providerBaseInfo?.name ?? this.getDefaultProviderName()
    const nickname = providerSettings?.models?.find((m) => m.modelId === model)?.nickname
    return Promise.resolve(`${providerName} (${nickname || model})`)
  }

  private getDefaultProviderName(): string {
    switch (this.customProviderType) {
      case ModelProviderType.Claude:
        return 'Custom Claude'
      case ModelProviderType.Gemini:
        return 'Custom Gemini'
      case ModelProviderType.OpenAIResponses:
        return 'Custom OpenAI Responses'
      default:
        return 'Custom API'
    }
  }

  // 只获取用户地址返回的模型，不查询 Chatbox 清单或远程模型目录。
  public override getMergeOptionGroups(settings: ProviderSettings): Promise<ProviderModelInfo[]> {
    return this.listProviderModels(settings)
  }

  protected async listProviderModels(settings: ProviderSettings): Promise<ProviderModelInfo[]> {
    const model = settings.models?.[0] || { modelId: '' }
    const dependencies = await createModelDependencies()

    switch (this.customProviderType) {
      case ModelProviderType.Claude: {
        const customClaude = new CustomClaude(
          {
            apiHost: settings.apiHost || '',
            apiKey: settings.apiKey || '',
            model,
            temperature: 0,
            useProxy: settings.useProxy,
          },
          dependencies
        )
        return customClaude.listModels()
      }
      case ModelProviderType.Gemini: {
        const customGemini = new CustomGemini(
          {
            apiHost: settings.apiHost || '',
            apiKey: settings.apiKey || '',
            model,
            temperature: 0,
            useProxy: settings.useProxy,
          },
          dependencies
        )
        return customGemini.listModels()
      }
      case ModelProviderType.OpenAIResponses: {
        const customOpenAIResponses = new CustomOpenAIResponses(
          {
            apiHost: settings.apiHost || '',
            apiKey: settings.apiKey || '',
            apiPath: settings.apiPath || '',
            model,
            temperature: 0,
            useProxy: settings.useProxy,
          },
          dependencies
        )
        return customOpenAIResponses.listModels()
      }
      case ModelProviderType.OpenAI: {
        const customOpenAI = new CustomOpenAI(
          {
            apiHost: settings.apiHost || '',
            apiKey: settings.apiKey || '',
            apiPath: settings.apiPath || '',
            model,
            temperature: 0,
            useProxy: settings.useProxy,
          },
          dependencies
        )
        return customOpenAI.listModels()
      }
      default:
        throw new Error('Please select a supported API protocol.')
    }
  }
}
