
const createSimulator = require('./simulator')
const _events = require('../events')(require('./options'))
const test = require('tape')
const progress = require('../progress')
const events = {}
for (const k in _events) {
  (function (fn, k) {
    events[k] = function (state, ev) {
      if (state.stalled) return state
      return fn(state, ev)
    }
  })(_events[k], k)
}

function createTest (seed, log) {
  test('simple test with seed:' + seed, function (t) {
    const tick = createSimulator(seed, log)

    const network = {}
    const alice = network.alice = tick.createPeer('alice')
    const bob = network.bob = tick.createPeer('bob')
    const carl = network.carl = tick.createPeer('carl')
    const dawn = network.dawn = tick.createPeer('dawn')

    alice.state.timeout = bob.state.timeout = dawn.state.timeout = 2
    alice.init({})
    bob.init({})
    carl.init({})
    dawn.init({})

    alice.append({ author: 'alice', sequence: 1, content: {} })
    alice.append({ author: 'alice', sequence: 2, content: {} })
    alice.append({ author: 'alice', sequence: 3, content: {} })
    bob.append({ author: 'bob', sequence: 1, content: {} })

    alice.follow('alice')
    alice.follow('bob')
    bob.follow('alice')
    bob.follow('bob')
    carl.follow('alice')
    carl.follow('bob')
    dawn.follow('alice')
    dawn.follow('bob')

    alice.connect(carl)
    bob.connect(carl)
    dawn.connect(carl)
    alice.connect(bob)
    dawn.connect(bob)

    tick.run(network)
    carl.state.stalled = true
    alice.append({ author: 'alice', sequence: 4, content: {} })

    tick.run(network)

    t.deepEqual(dawn.store, alice.store, 'dawn matches alice')
    t.deepEqual(bob.store, alice.store, 'bob matches alice')

    function isComplete (peer, name) {
      const prog = progress(peer.state)
      t.equal(prog.current, prog.target, name + ' is complete')
    }

    isComplete(alice, 'alice')
    isComplete(bob, 'bob')
    isComplete(dawn, 'dawn')

    t.end()
  })
}

const seed = process.argv[2]
if (isNaN(seed)) { for (let i = 0; i < 100; i++) createTest(i) } else createTest(+seed, true)
