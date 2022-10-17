const createSimulator = require('./simulator')
const options = require('./options')
const progress = require('../progress')
const test = require('tape')

function count (output) {
  return output.reduce(function (a, b) {
    return b.msg ? a : a + 1
  }, 0)
}

function flatten (output) {
  return output.reduce(function (a, b) {
    if (b.msg) return a
    for (const k in b.value) { a[b.from][k] = options.getSequence(b.value[k]) }
    return a
  }, { alice: {}, bob: {} })
}

function isComplete (peer, name, t) {
  const prog = progress(peer.state)
  t.equal(prog.current, prog.target, name + ' is complete')
}

test('write error', function (t) {
  const tick = createSimulator(0, true, options)

  const network = {}
  const alice = network.alice = tick.createPeer('alice')
  const bob = network.bob = tick.createPeer('bob')

  alice.init({})
  bob.init({})

  alice.append({ author: 'alice', sequence: 1, content: {} })
  alice.append({ author: 'alice', sequence: 2, content: {} })
  alice.append({ author: 'alice', sequence: 3, content: {} })
  bob.append({ author: 'bob', sequence: 1, content: {} })
  bob.append({ author: 'bob', sequence: 2, content: {} })

  alice.follow('bob')
  alice.follow('alice')
  bob.follow('alice')
  bob.follow('bob')

  alice.connect(bob)

  while (tick(network)) ;

  const bobPeerState = alice.state.peers.bob
  console.log('bob peer state', bobPeerState)

  alice.disconnect(bob)

  // should have set up peer.replicatings to tx/rx alice
  t.deepEqual(flatten(tick.output), { alice: { alice: 3, bob: 0 }, bob: { alice: 0, bob: 2 } })
  t.equal(count(tick.output), 2)

  t.deepEqual(bob.store, alice.store)

  console.log('alice store', alice.store)
  console.log('bob store', bob.store)

  isComplete(alice, 'alice', t)
  isComplete(bob, 'bob', t)

  console.log('===========START OVER===========')

  // bob has a write error

  bob.store.alice = bob.store.alice.slice(0, 2)
  bob.clocks.alice.alice = 2
  bob.state.clock.alice = 2

  alice.append({ author: 'alice', sequence: 4, content: {} })

  alice.connect(bob)

  // restore state
  alice.state.peers.bob.clock = { alice: 3, bob: 2 }

  while (tick(network)) ;

  t.equal(bob.store.alice.length, 4, 'bob has all alices messages')

  t.end()
})
