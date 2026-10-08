import NiceModal from '@ebay/nice-modal-react'
import CopilotSettingsModal from '../routes/copilots/-components/CopilotSettingsModal'
import ClearSessionList from './ClearSessionList'
import ConfirmModal from './ConfirmModal'
import ContentViewer from './ContentViewer'
import ExportChat from './ExportChat'
import JsonViewer from './JsonViewer'
import MessageEdit from './MessageEdit'
import ModelEdit from './ModelEdit'
import SessionSettings from './SessionSettings'
import ThreadNameEdit from './ThreadNameEdit'

NiceModal.register('content-viewer', ContentViewer)
NiceModal.register('session-settings', SessionSettings)
NiceModal.register('clear-session-list', ClearSessionList)
NiceModal.register('confirm', ConfirmModal)
NiceModal.register('export-chat', ExportChat)
NiceModal.register('message-edit', MessageEdit)
NiceModal.register('json-viewer', JsonViewer)
NiceModal.register('model-edit', ModelEdit)
NiceModal.register('thread-name-edit', ThreadNameEdit)
NiceModal.register('copilot-settings', CopilotSettingsModal)
