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

test('loose local state', function (t) {
  const tick = createSimulator(0, true, options)

  const network = {}
  const alice = network.alice = tick.createPeer('alice')
  let bob = network.bob = tick.createPeer('bob')

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

  alice.disconnect(bob)

  // should have set up peer.replicatings to tx/rx alice
  t.deepEqual(flatten(tick.output), { alice: { alice: 3, bob: 0 }, bob: { alice: 0, bob: 2 } })
  t.equal(count(tick.output), 2)

  t.deepEqual(bob.store, alice.store)

  isComplete(alice, 'alice', t)
  isComplete(bob, 'bob', t)

  console.log('===========START OVER===========')

  // bob gets a brick in his head and forgets everything
  bob = network.bob = tick.createPeer('bob')
  bob.init({})
  t.deepEqual(bob.store, {})

  bob.follow('bob')

  alice.connect(bob)

  while (tick(network)) ;

  console.log('===========SECOND ROUND===========')

  // simulate a contact message received in bobs feed
  bob.follow('alice')

  while (tick(network)) ;

  t.deepEqual(bob.store, alice.store)

  isComplete(alice, 'alice', t)
  isComplete(bob, 'bob', t)

  alice.disconnect(bob)

  console.log('===========START OVER 2===========')

  // bob gets a brick in his head and restores from backup
  bob = network.bob = tick.createPeer('bob')
  bob.init({})

  bob.append({ author: 'bob', sequence: 1, content: {} })

  bob.follow('bob')

  alice.connect(bob)

  while (tick(network)) ;

  console.log('===========SECOND ROUND===========')

  // simulate a contact message received in bobs feed
  bob.follow('alice')

  while (tick(network)) ;

  t.deepEqual(bob.store, alice.store)

  isComplete(alice, 'alice', t)
  isComplete(bob, 'bob', t)

  t.end()
})
