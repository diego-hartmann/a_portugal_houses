import express from 'express'
import { getEnvironment } from '../environment.js'

const environment = await getEnvironment()

export function runWebserver(): void {
  const app = express()
  app.get('/health', (_req, res) => {
    res.send('ok')
  })
  const PORT = environment.secrets.port || 3000
  app.listen(PORT, () => {
    console.log('HTTP up on', PORT)
  })
}
