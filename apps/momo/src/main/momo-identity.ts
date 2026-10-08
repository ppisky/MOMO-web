import path from 'node:path'
import { app } from 'electron'

app.setName('MOMO')
if (!process.argv.some((arg) => arg.startsWith('--user-data-dir'))) {
  app.setPath('userData', path.join(app.getPath('appData'), 'MOMO-Chatbox'))
}
