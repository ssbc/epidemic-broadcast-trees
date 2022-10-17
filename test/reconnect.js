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

function createTest (seed, log) {
  test('simple test with seed:' + seed, function (t) {
    const tick = createSimulator(seed, log, options)

    const network = {}
    const alice = network.alice = tick.createPeer('alice')
    const bob = network.bob = tick.createPeer('bob')

    alice.init({})
    bob.init({})

    alice.append({ author: 'alice', sequence: 1, content: {} })
    alice.append({ author: 'alice', sequence: 2, content: {} })
    alice.append({ author: 'alice', sequence: 3, content: {} })
    bob.append({ author: 'bob', sequence: 1, content: {} })

    alice.follow('alice')
    alice.follow('bob')
    bob.follow('alice')
    bob.follow('bob')

    alice.connect(bob)

    while (tick(network)) ;

    alice.disconnect(bob)
    // should have set up peer.replicatings to tx/rx alice
    t.deepEqual(flatten(tick.output), { alice: { alice: 3, bob: 0 }, bob: { alice: 0, bob: 1 } })
    t.equal(count(tick.output), 2)
    bob.append({ author: 'bob', sequence: 2, content: {} })

    console.log('1', tick.output)
    tick.output.splice(0, tick.output.length)
    while (tick(network)) ;

    console.log('2', tick.output)
    tick.output.splice(0, tick.output.length)
    alice.connect(bob)
    while (tick(network)) ;

    console.log('3', tick.output)
    t.deepEqual(flatten(tick.output), { alice: { alice: 3, bob: 1 }, bob: { alice: 3, bob: 2 } })
    t.equal(count(tick.output), 3)
    tick.output.splice(0, tick.output.length)

    alice.disconnect(bob)
    alice.connect(bob)
    while (tick(network)) ;

    t.deepEqual(bob.store, alice.store)
    console.log('4', tick.output)
    tick.output.splice(0, tick.output.length)

    function isComplete (peer, name) {
      const prog = progress(peer.state)
      t.equal(prog.current, prog.target, name + ' is complete')
    }

    isComplete(alice, 'alice')
    isComplete(bob, 'bob')

    t.end()
  })
}

const seed = process.argv[2]
if (isNaN(seed)) { for (let i = 0; i < 100; i++) createTest(i) } else createTest(+seed, true)
