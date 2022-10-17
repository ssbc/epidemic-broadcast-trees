const createSimulator = require('./simulator')
const options = require('./options')

const test = require('tape')

test('partial replication', function (t) {
  const tick = createSimulator(0, true, options)

  const network = {}
  const alice = network.alice = tick.createPeer('alice')
  const bob = network.bob = tick.createPeer('bob')
  const charlie = network.charlie = tick.createPeer('charlie')

  alice.init({})
  bob.init({})
  charlie.init({})

  alice.append({ author: 'alice', sequence: 1, content: {} })
  alice.append({ author: 'alice', sequence: 2, content: {} })
  alice.append({ author: 'alice', sequence: 3, content: {} })

  // alice.store['alice'] = alice.store['alice'].slice(1)

  alice.follow('alice')
  bob.follow('alice')

  bob.follow('charlie')
  charlie.follow('bob')
  charlie.follow('alice')

  alice.connect(bob)

  while (tick(network)) ;

  // alice sends her whole feed to bob
  t.deepEqual(bob.store, alice.store)

  alice.disconnect(bob)

  // lets assume that instead bob had done a partial replication with alice
  bob.store.alice = bob.store.alice.slice(1)

  bob.connect(charlie)

  while (tick(network)) ;

  // charlie is not able to get alices feed from bob
  t.deepEqual({}, charlie.store)

  charlie.connect(alice)

  while (tick(network)) ;

  // charlie should now have alices feed
  t.deepEqual(alice.store, charlie.store)

  t.end()
})
