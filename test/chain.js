
var createSimulator = require('../simulator')
var events = require('../rewrite')

var test = require('tape')

function createTest (seed, log) {
  test('simple test with seed:'+seed, function (t) {
    var tick = createSimulator(seed, log)

    var network = {}
    var alice = network['alice'] = tick.createPeer('alice')
    var bob = network['bob'] = tick.createPeer('bob')
    var charles = network['charles'] = tick.createPeer('charles')

    alice.init({})
    bob.init({})
    charles.init({})

    alice.append({author: 'alice', sequence: 1, content: {}})
    alice.append({author: 'alice', sequence: 2, content: {}})
    alice.append({author: 'alice', sequence: 3, content: {}})

    alice.follow('alice')
    bob.follow('alice')
    charles.follow('alice')

    alice.connect(bob)
    bob.connect(charles)

    while(tick(network)) ;

    //should have set up peer.replicatings to tx/rx alice

    t.deepEqual(bob.store, alice.store, 'alice<->bob')
    t.deepEqual(charles.store, bob.store, 'charles<->bob')
    t.end()
  })
}

var seed = process.argv[2]
if(isNaN(seed))
  for(var i = 0; i < 100; i++)
    createTest(i, false)
else
  createTest(+seed, true)









