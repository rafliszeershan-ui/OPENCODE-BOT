let ws = null
let authenticated = false

const $ = id => document.getElementById(id)

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${proto}//${location.host}`)

  ws.onopen = () => {
    if (authenticated) {
      ws.send(JSON.stringify({ type: 'auth', password: sessionStorage.getItem('pinecone_pw') }))
    }
  }

  ws.onmessage = (e) => {
    let data
    try { data = JSON.parse(e.data) } catch { return }
    handleMessage(data)
  }

  ws.onclose = () => {
    authenticated = false
    setTimeout(connect, 3000)
  }

  ws.onerror = () => ws.close()
}

function handleMessage(data) {
  switch (data.type) {
    case 'auth':
      if (data.ok) {
        authenticated = true
        $('login').classList.add('hidden')
        $('dashboard').classList.remove('hidden')
      } else {
        $('login-error').classList.remove('hidden')
      }
      break

    case 'bots':
      renderBots(data.bots)
      renderPlayers(data.players)
      renderCounts(data.bots)
      break

    case 'result':
      console.log(data.msg || data.reason)
      break

    case 'results':
      data.results.forEach(r => console.log(`${r.bot}: ${r.msg || r.reason}`))
      break

    case 'error':
      console.error(data.msg)
      break
  }
}

function renderBots(bots) {
  const grid = $('bots-grid')
  grid.innerHTML = bots.map(b => {
    const statusClass = b.status
    const statusLabel = b.status.charAt(0).toUpperCase() + b.status.slice(1)
    const following = b.following ? `<br/>Following: <strong>${b.following}</strong>` : ''
    const lastMsg = b.lastMessage ? `<br/>Last: "${b.lastMessage}"` : ''
    const uptime = b.uptime ? ` (${Math.floor(b.uptime / 60)}m)` : ''

    return `<div class="bot-card">
      <div class="bot-header">
        <span class="bot-dot ${statusClass}"></span>
        <span class="bot-name">${b.name}</span>
        <span class="bot-status-text">${statusLabel}${uptime}</span>
      </div>
      <div class="bot-details">${following}${lastMsg}</div>
      <div class="bot-actions">
        <button onclick="cmd('${b.name}','follow_nearest')">Follow</button>
        <button onclick="cmd('${b.name}','stop_follow')">Stop</button>
        <button onclick="cmd('${b.name}','trigger_scary')">Scare</button>
        <button class="btn-danger" onclick="cmd('${b.name}','restart')">Restart</button>
        <button class="btn-danger" onclick="cmd('${b.name}','stop')">Kill</button>
      </div>
    </div>`
  }).join('')
}

function renderPlayers(players) {
  const el = $('players-list')
  if (!players || players.length === 0) {
    el.innerHTML = '<em>No players online</em>'
    return
  }
  el.innerHTML = players.map(p =>
    `<span class="player-tag">
      ${p}
      <button class="follow-btn" onclick="cmd('all','follow','${p}')">[follow]</button>
    </span>`
  ).join('')
}

function renderCounts(bots) {
  const online = bots.filter(b => b.status === 'online' || b.status === 'following').length
  $('online-count').textContent = online
  $('total-count').textContent = bots.length
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

function cmd(bot, action, arg) {
  const payload = { type: 'command', command: action, payload: {} }

  if (action === 'follow') {
    payload.command = 'follow'
    payload.payload.player = arg
  } else if (action === 'follow_nearest') {
    payload.command = 'follow'
    payload.payload.player = null
  } else if (action === 'trigger_scary') {
    payload.command = 'chat'
    const msgs = [
      'i see you...',
      'you are not safe here',
      'the void is watching',
      'dont turn around',
    ]
    payload.payload.message = msgs[Math.floor(Math.random() * msgs.length)]
  } else if (action === 'stop') {
    payload.type = 'stop'
  } else if (action === 'restart') {
    payload.type = 'restart'
  } else if (action === 'stop_follow') {
    payload.command = 'stop_follow'
  }

  payload.bot = bot
  send(payload)
}

// Broadcast: chat to all bots
$('broadcast-chat-btn').addEventListener('click', () => {
  const msg = $('broadcast-chat').value.trim()
  if (!msg) return
  send({ type: 'broadcast', command: 'chat', payload: { message: msg } })
  $('broadcast-chat').value = ''
})

$('broadcast-chat').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('broadcast-chat-btn').click()
})

$('broadcast-follow').addEventListener('click', () => {
  send({ type: 'broadcast', command: 'follow', payload: { player: null } })
})

$('broadcast-stop').addEventListener('click', () => {
  send({ type: 'broadcast', command: 'stop_follow', payload: {} })
})

$('broadcast-scary').addEventListener('click', () => {
  const msgs = [
    'i see you...',
    'you are not safe here',
    'the void is watching',
    'dont turn around',
    'we are all trapped here',
  ]
  const msg = msgs[Math.floor(Math.random() * msgs.length)]
  send({ type: 'broadcast', command: 'chat', payload: { message: msg } })
})

// Login
$('login-btn').addEventListener('click', () => {
  const pw = $('password-input').value.trim()
  if (!pw) return
  sessionStorage.setItem('pinecone_pw', pw)
  send({ type: 'auth', password: pw })
})

$('password-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('login-btn').click()
})

// Logout
$('logout-btn').addEventListener('click', () => {
  authenticated = false
  sessionStorage.removeItem('pinecone_pw')
  $('dashboard').classList.add('hidden')
  $('login').classList.remove('hidden')
  $('password-input').value = ''
})

// Start connection
connect()
