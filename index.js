const express = require('express')
const http = require('http')
const path = require('path')
const { WebSocketServer } = require('ws')
const config = require('./config')
const BotManager = require('./bot-manager')

const app = express()
const server = http.createServer(app)

app.use(express.static(path.join(__dirname, 'public')))

app.get('/health', (req, res) => res.send('OK'))

const wss = new WebSocketServer({ server })

const manager = new BotManager(config)
manager.startAll()

function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.authenticated) {
      client.send(msg)
    }
  })
}

manager.on('update', () => {
  broadcast({ type: 'bots', bots: manager.getStatus(), players: manager.getPlayers() })
})

wss.on('connection', (ws) => {
  ws.authenticated = false

  ws.on('message', (raw) => {
    let data
    try { data = JSON.parse(raw.toString()) } catch { return }

    if (data.type === 'auth') {
      if (data.password === config.dashboard.password) {
        ws.authenticated = true
        ws.send(JSON.stringify({ type: 'auth', ok: true }))
        ws.send(JSON.stringify({ type: 'bots', bots: manager.getStatus(), players: manager.getPlayers() }))
      } else {
        ws.send(JSON.stringify({ type: 'auth', ok: false }))
      }
      return
    }

    if (!ws.authenticated) {
      ws.send(JSON.stringify({ type: 'error', msg: 'Not authenticated' }))
      return
    }

    if (data.type === 'command' && data.bot) {
      const result = manager.sendCommand(data.bot, data.command, data.payload || {})
      ws.send(JSON.stringify({ type: 'result', bot: data.bot, ...result }))
      manager.emit('update')
    }

    if (data.type === 'broadcast' && data.command) {
      const results = manager.broadcastCommand(data.command, data.payload || {})
      ws.send(JSON.stringify({ type: 'results', results }))
      manager.emit('update')
    }

    if (data.type === 'stop' && data.bot) {
      const result = manager.stopBot(data.bot)
      ws.send(JSON.stringify({ type: 'result', bot: data.bot, ...result }))
    }

    if (data.type === 'restart' && data.bot) {
      const result = manager.restartBot(data.bot)
      ws.send(JSON.stringify({ type: 'result', bot: data.bot, ...result }))
    }

    if (data.type === 'status') {
      ws.send(JSON.stringify({ type: 'bots', bots: manager.getStatus(), players: manager.getPlayers() }))
    }
  })
})

const PORT = config.dashboard.port
server.listen(PORT, () => {
  console.log(`Dashboard: http://localhost:${PORT}`)
  console.log(`Password: ${config.dashboard.password}`)
  console.log(`${config.bots.length} bots configured`)
})
