const express = require('express')
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const config = require('./config')

const app = express()
app.get('/health', (req, res) => res.send('OK'))
app.get('/', (req, res) => res.send('PineconeMC Haunt Bots running'))
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Health check server on port ${PORT}`)
})

function createBot(botConfig) {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: botConfig.name,
    version: config.version,
  })

  bot.loadPlugin(pathfinder)

  bot.on('spawn', () => {
    console.log(`${botConfig.name} spawned`)

    try {
      const mcData = require('minecraft-data')(bot.version)
      const defaultMove = new Movements(bot, mcData)
      bot.pathfinder.setMovements(defaultMove)
    } catch (e) {
      console.log(`Movements setup failed for ${botConfig.name}: ${e.message}`)
    }

    setInterval(() => {
      if (!bot.entity) return
      const player = bot.nearestEntity(e => e.type === 'player' && e.username !== bot.username)
      if (player) {
        const dist = bot.entity.position.distanceTo(player.position)
        if (dist < 100) {
          try {
            const goal = new goals.GoalNear(player.position.x, player.position.y, player.position.z, 2)
            bot.pathfinder.setGoal(goal)
            bot.lookAt(player.position.offset(0, 1.6, 0))
          } catch (e) {}
        } else {
          bot.pathfinder.stop()
        }
      } else {
        bot.pathfinder.stop()
      }
    }, 3000)

    const chatLoop = () => {
      if (!bot.entity) return
      const msg = config.scaryMessages[Math.floor(Math.random() * config.scaryMessages.length)]
      try { bot.chat(msg) } catch (e) {}
      setTimeout(chatLoop, 20000 + Math.random() * 40000)
    }
    setTimeout(chatLoop, 5000 + Math.random() * 10000)
  })

  bot.on('end', (reason) => {
    console.log(`${botConfig.name} disconnected: ${reason}. Reconnecting in 10s...`)
    setTimeout(() => createBot(botConfig), 10000)
  })

  bot.on('error', (err) => {
    console.log(`${botConfig.name} error: ${err.message}`)
  })

  return bot
}

console.log('Starting PineconeMC haunting bots...')
config.bots.forEach(createBot)
console.log(`${config.bots.length} bots configured`)
