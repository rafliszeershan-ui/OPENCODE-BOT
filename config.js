module.exports = {
  host: 'Fareedsolabewbew.playwithbao.com',
  port: 25565,
  version: false,

  dashboard: {
    password: 'pinecone123',
    port: process.env.PORT || 3000,
  },

  protectedPlayers: [
    'rafliszeershan',
  ],

  botPrefixes: [
    'Entity_', 'Ghost_', 'Void_', 'Wither_', 'Notch_',
    'Herobrine_', 'Shadow_', 'Phantom_', 'Spectre_', 'Spirit_',
    'Cursed_', 'Haunted_', 'Possessed_', 'Demonic_', 'Eternal_',
  ],

  botSuffixes: [
    '_303', '_666', '_xX', 'Xx', '_TV', '_HD',
    '', '_MC', '_TheGhoul', '_TheVoid', '_Bot',
  ],

  bots: [
    { name: 'Entity_303' },
    { name: 'Ghost_' },
    { name: 'VoidWalker' },
    { name: 'Wither_' },
    { name: 'Notch_' },
  ],

  scaryMessages: [
    'i see you...',
    'can you hear me?',
    'this server... it keeps me here...',
    'you shouldnt have joined tonight',
    'the void is watching',
    'im standing right behind you',
    'there used to be others... now its just me',
    'help... me...',
    'do you feel the cold?',
    'your world is not your own anymore',
    'i was a player once too',
    'dont turn around',
    'the server admin... he cant see them',
    'they come out when its dark',
    'you are not safe here',
    'we are all trapped here',
    'your friends will leave you behind',
    'nice build... its a shame',
    'i can see your screen',
    'why did you come here?',
  ],
}
