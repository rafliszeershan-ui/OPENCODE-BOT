const EventEmitter = require('events')
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')

function randomName(prefixes, suffixes) {
  const p = prefixes[Math.floor(Math.random() * prefixes.length)]
  const s = suffixes[Math.floor(Math.random() * suffixes.length)]
  const n = Math.floor(Math.random() * 999)
  return `${p}${n}${s}`
}

function isBanned(reason) {
  if (!reason) return false
  const r = reason.toLowerCase()
  return r.includes('ban') || r.includes('kick') || r.includes('permanent') || r.includes('temp') || r.includes('ip')
}

class BotManager extends EventEmitter {
  constructor(config) {
    super()
    this.config = config
    this.bots = {}
    this.usedNames = new Set()
    config.bots.forEach(b => this.usedNames.add(b.name))
  }

  isProtected(name) {
    return (this.config.protectedPlayers || []).some(p => p.toLowerCase() === (name || '').toLowerCase())
  }

  freshName() {
    let name
    let tries = 0
    do {
      name = randomName(this.config.botPrefixes, this.config.botSuffixes)
      tries++
    } while (this.usedNames.has(name) && tries < 100)
    this.usedNames.add(name)
    return name
  }

  startAll() {
    this.config.bots.forEach(bc => this.startBot(bc))
  }

  startBot(botConfig) {
    const entry = {
      config: botConfig,
      status: 'connecting',
      following: null,
      followTarget: null,
      lastMessage: null,
      startedAt: Date.now(),
      bot: null,
    }
    this.bots[botConfig.name] = entry
    this.connect(botConfig)
    this.emit('update')
  }

  connect(botConfig) {
    const bot = mineflayer.createBot({
      host: this.config.host,
      port: this.config.port,
      username: botConfig.name,
      version: this.config.version,
    })

    bot.loadPlugin(pathfinder)
    const entry = this.bots[botConfig.name]
    entry.bot = bot
    entry.status = 'connecting'

    bot.on('spawn', () => {
      entry.status = 'online'
      entry.followTarget = null
      this.emit('update')

      try {
        const mcData = require('minecraft-data')(bot.version)
        const defaultMove = new Movements(bot, mcData)
        bot.pathfinder.setMovements(defaultMove)
      } catch (e) {
        console.log(`Movements failed for ${botConfig.name}: ${e.message}`)
      }

      if (!entry._followInterval) {
        entry._followInterval = setInterval(() => this.tickFollow(botConfig), 3000)
      }
      if (!entry._chatTimer) {
        entry._chatTimer = true
        this.scheduleChat(botConfig)
      }
    })

    bot.on('kicked', (reason) => {
      console.log(`${botConfig.name} was kicked: ${reason}`)
    })

    bot.on('end', (reason) => {
      const wasBanned = isBanned(reason)
      const oldName = botConfig.name

      if (wasBanned) {
        const newName = this.freshName()
        console.log(`${oldName} was BANNED! Respawned as ${newName}`)
        this.usedNames.delete(oldName)
        delete this.bots[oldName]
        botConfig.name = newName
        this.bots[newName] = entry
        entry.config = botConfig
      }

      entry.bot = null
      entry.status = 'disconnected'
      this.emit('update')
      setTimeout(() => this.connect(botConfig), 10000)
    })

    bot.on('error', (err) => {
      console.log(`${botConfig.name} error: ${err.message}`)
    })
  }

  tickFollow(botConfig) {
    const entry = this.bots[botConfig.name]
    const bot = entry.bot
    if (!bot || !bot.entity) return

    let target = null

    if (entry.followTarget) {
      if (this.isProtected(entry.followTarget)) {
        entry.followTarget = null
        bot.pathfinder.stop()
        entry.status = 'online'
        return
      }
      const pdata = Object.values(bot.players).find(p => p.username === entry.followTarget)
      if (pdata && pdata.entity) {
        target = pdata.entity
        entry.following = entry.followTarget
      } else {
        entry.following = entry.followTarget + ' (lost)'
      }
    } else {
      const nearest = bot.nearestEntity(e => {
        if (e.type !== 'player') return false
        if (e.username === bot.username) return false
        return !this.isProtected(e.username)
      })
      if (nearest) {
        target = nearest
        entry.following = nearest.username
      } else {
        entry.following = null
      }
    }

    if (target) {
      const dist = bot.entity.position.distanceTo(target.position)
      if (dist < 100) {
        try {
          const goal = new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2)
          bot.pathfinder.setGoal(goal)
          bot.lookAt(target.position.offset(0, 1.6, 0))
          if (entry.followTarget || dist > 3) {
            entry.status = 'following'
          }
        } catch (e) {}
        return
      }
    }
    bot.pathfinder.stop()
    if (!entry.followTarget) {
      entry.status = 'online'
    }
  }

  scheduleChat(botConfig) {
    const entry = this.bots[botConfig.name]
    const delay = 20000 + Math.random() * 40000
    setTimeout(() => {
      const bot = entry.bot
      if (bot && bot.entity) {
        const msg = this.config.scaryMessages[Math.floor(Math.random() * this.config.scaryMessages.length)]
        try {
          bot.chat(msg)
          entry.lastMessage = msg
          this.emit('update')
        } catch (e) {}
      }
      this.scheduleChat(botConfig)
    }, delay)
  }

  sendCommand(botName, type, payload) {
    const entry = this.bots[botName]
    if (!entry || !entry.bot || !entry.bot.entity) return { ok: false, reason: 'Bot offline' }

    const bot = entry.bot
    switch (type) {
      case 'follow':
        if (payload.player && this.isProtected(payload.player)) {
          return { ok: false, reason: 'Cannot follow protected player' }
        }
        entry.followTarget = payload.player || null
        return { ok: true, msg: `Following ${payload.player || 'nearest player'}` }
      case 'stop_follow':
        entry.followTarget = null
        bot.pathfinder.stop()
        return { ok: true, msg: 'Stopped following' }
      case 'chat':
        bot.chat(String(payload.message))
        entry.lastMessage = String(payload.message)
        this.emit('update')
        return { ok: true, msg: 'Message sent' }
      case 'look':
        bot.look(parseFloat(payload.yaw) || 0, parseFloat(payload.pitch) || 0)
        return { ok: true, msg: 'Looked' }
      default:
        return { ok: false, reason: 'Unknown command' }
    }
  }

  stopBot(botName) {
    const entry = this.bots[botName]
    if (!entry || !entry.bot) return { ok: false, reason: 'Bot not running' }
    try { entry.bot.end('stopped') } catch (e) {}
    entry.bot = null
    entry.status = 'stopped'
    this.emit('update')
    return { ok: true, msg: 'Bot stopped' }
  }

  restartBot(botName) {
    this.stopBot(botName)
    const entry = this.bots[botName]
    if (entry) {
      setTimeout(() => this.connect(entry.config), 2000)
    }
    return { ok: true, msg: 'Restarting...' }
  }

  broadcastCommand(type, payload) {
    const results = []
    Object.keys(this.bots).forEach(name => {
      const r = this.sendCommand(name, type, payload)
      results.push({ bot: name, ...r })
    })
    return results
  }

  getStatus() {
    return Object.values(this.bots).map(e => ({
      name: e.config.name,
      status: e.status,
      following: e.following,
      lastMessage: e.lastMessage,
      uptime: e.startedAt ? Math.floor((Date.now() - e.startedAt) / 1000) : 0,
    }))
  }

  getPlayers() {
    for (const entry of Object.values(this.bots)) {
      if (entry.bot && entry.bot.players) {
        return Object.keys(entry.bot.players).filter(name => !this.bots[name])
      }
    }
    return []
  }
}

module.exports = BotManager
