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
    alice.connect(charles)

    while (tick(network)) ;

    // should have set up peer.replicatings to tx/rx alice

    t.deepEqual(bob.store, alice.store, 'alice<->bob')
    t.deepEqual(charles.store, alice.store, 'charles<->alice')

    alice.disconnect(charles)

    alice.append({ author: 'alice', sequence: 4, content: {} })
    alice.append({ author: 'alice', sequence: 5, content: {} })

    while (tick(network)) ;

    t.deepEqual(bob.store, alice.store, 'alice<->bob')
    t.notDeepEqual(charles.store, alice.store, 'alice<->bob')

    bob.connect(charles)

    alice.append({ author: 'alice', sequence: 6, content: {} })

    while (tick(network)) ;

    t.deepEqual(bob.store, alice.store, 'alice<->bob')
    t.deepEqual(charles.store, alice.store, 'charles<->alice')

    const totals = tick.output.reduce(function (a, b) {
      if (!a) a = [0, 0, 0]; a[0]++; a[1 + (+b.msg)]++
      return a
    }, null)

    t.equal(totals[1], 3 * 2, 'number of handshakes sent is connections*2')
    t.equal(totals[2], 6 * (3 - 1), 'number of msgs sent is msgs*(peers-1)')

    const prog = progress(alice.state)
    t.equal(prog.current, prog.target)
    const prog2 = progress(bob.state)
    t.equal(prog2.current, prog2.target)

    console.log(alice.state.peers.bob)

    if (log) {
      console.log(
        tick.output.map(function (e) {
          if (e.msg) { return e.from + '>' + e.to + ':' + e.value.sequence } else { return e.from + '>' + e.to + ':' + JSON.stringify(e.value) }
        }).join('\n')
      )
    }

    t.end()
  })
}

const seed = process.argv[2]
if (isNaN(seed)) for (let i = 0; i < 100; i++) createTest(i)
else createTest(+seed, true)
