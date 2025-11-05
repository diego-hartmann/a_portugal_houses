import express from 'express'

export function runWebserver(): void {
  const app = express()
  app.get('/health', (_req, res) => {
    res.send('ok')
  })
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log('HTTP up on', PORT)
  })
}
