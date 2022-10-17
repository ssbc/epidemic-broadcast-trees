
const createSimulator = require('./simulator')
const options = require('./options')

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
    alice.connect(charles)
    bob.connect(charles)

    while (tick(network)) ;

    // should have set up peer.replicatings to tx/rx alice

    t.deepEqual(bob.store, alice.store, 'alice<->bob')
    t.deepEqual(charles.store, alice.store, 'charles<->alice')

    if (log) tick.log()

    t.end()
  })
}

const seed = process.argv[2]
if (isNaN(seed)) {
  for (let i = 0; i < 100; i++) { createTest(i) }
} else { createTest(+seed, true) }
