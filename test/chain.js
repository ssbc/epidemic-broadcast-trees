
const createSimulator = require('./simulator')
const options = require('./options')
const progress = require('../progress')

const test = require('tape')

function createTest (seed, log) {
  test('simple test with seed:' + seed, function (t) {
    const tick = createSimulator(seed, log, options)

    const network = {}
    const alice = network.alice = tick.createPeer('alice')
    const bob = network.bob = tick.createPeer('bob')
    const charles = network.charles = tick.createPeer('charles')

    alice.init({})
    bob.init({})
    charles.init({})

    alice.append({ author: 'alice', sequence: 1, content: {} })
    alice.append({ author: 'alice', sequence: 2, content: {} })
    alice.append({ author: 'alice', sequence: 3, content: {} })

    alice.follow('alice')
    bob.follow('alice')
    charles.follow('alice')

    alice.connect(bob)
    bob.connect(charles)

    while (tick(network)) ;

    // should have set up peer.replicatings to tx/rx alice

    t.deepEqual(bob.store, alice.store, 'alice<->bob')
    t.deepEqual(charles.store, bob.store, 'charles<->bob')

    function isComplete (peer) {
      const prog = progress(peer.state)
      t.equal(prog.current, prog.target)
    }

    isComplete(alice)
    isComplete(bob)
    isComplete(charles)

    t.end()
  })
}

const seed = process.argv[2]
if (isNaN(seed)) {
  for (let i = 0; i < 100; i++) { createTest(i, false) }
} else { createTest(+seed, true) }
