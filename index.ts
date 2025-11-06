import { Bot } from './src/bot/index.js'
import { WebServer } from './src/api/index.js'
import { leadCreator } from './src/lead_creation/index.js'

new WebServer()

const bot = new Bot(leadCreator)
await bot.initChatFlow()
