console.log('Starting...')

process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err.message)
})
process.on('unhandledRejection', (err) => {
  console.error('Unhandled:', err?.message || err)
})

const express = require('express')
const http = require('http')
const path = require('path')
const { WebSocketServer } = require('ws')
const config = require('./config')

let skinGen, BotManager
try {
  skinGen = require('./skin')
  BotManager = require('./bot-manager')
} catch (e) {
  console.error('Failed to load modules:', e.message)
}

const app = express()
const server = http.createServer(app)

app.use(express.static(path.join(__dirname, 'public')))

app.get('/health', (req, res) => res.send('OK'))

if (skinGen) {
  app.get('/skin/:id', (req, res) => {
    const id = parseInt(req.params.id) || 0
    try {
      const png = skinGen.getSkin(id)
      res.set('Content-Type', 'image/png')
      res.send(png)
    } catch (e) {
      res.status(500).send('Skin error')
    }
  })
}

let manager = null

const wss = new WebSocketServer({ server })

function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.authenticated) {
      client.send(msg)
    }
  })
}

wss.on('connection', (ws) => {
  ws.authenticated = false

  ws.on('message', (raw) => {
    let data
    try { data = JSON.parse(raw.toString()) } catch { return }

    if (data.type === 'auth') {
      if (data.password === config.dashboard.password) {
        ws.authenticated = true
        ws.send(JSON.stringify({ type: 'auth', ok: true }))
        if (manager) {
          ws.send(JSON.stringify({ type: 'bots', bots: manager.getStatus(), players: manager.getPlayers() }))
        }
      } else {
        ws.send(JSON.stringify({ type: 'auth', ok: false }))
      }
      return
    }

    if (!ws.authenticated) {
      ws.send(JSON.stringify({ type: 'error', msg: 'Not authenticated' }))
      return
    }

    if (!manager) {
      ws.send(JSON.stringify({ type: 'error', msg: 'Bot manager not ready' }))
      return
    }

    if (data.type === 'command' && data.bot) {
      const result = manager.sendCommand(data.bot, data.command, data.payload || {})
      ws.send(JSON.stringify({ type: 'result', bot: data.bot, ...result }))
    }

    if (data.type === 'broadcast' && data.command) {
      const results = manager.broadcastCommand(data.command, data.payload || {})
      ws.send(JSON.stringify({ type: 'results', results }))
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
  console.log(`Dashboard: http://0.0.0.0:${PORT}`)
  console.log(`Password: ${config.dashboard.password}`)

  if (BotManager) {
    setTimeout(() => {
      try {
        manager = new BotManager(config)
        manager.on('update', () => {
          broadcast({ type: 'bots', bots: manager.getStatus(), players: manager.getPlayers() })
        })
        manager.startAll()
        console.log('Bot manager started')
      } catch (e) {
        console.error('Bot manager failed:', e.message)
      }
    }, 1000)
  }
})
