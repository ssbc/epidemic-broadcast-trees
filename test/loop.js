
var createSimulator = require('../simulator')

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
    alice.connect(charles)
    bob.connect(charles)

    while(tick(network)) ;

    //should have set up peer.replicatings to tx/rx alice

    t.deepEqual(bob.store, alice.store, 'alice<->bob')
    t.deepEqual(charles.store, alice.store, 'charles<->alice')

    if(log) tick.log()

    t.end()
  })
}

var seed = process.argv[2]
if(isNaN(seed))
  for(var i = 0; i < 100; i++)
    createTest(i)
else
  createTest(+seed, true)










