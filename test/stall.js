var createSimulator = require('./simulator')
var events = require('../events')()
var test = require('tape')

function createTest (seed, log) {
  test('simple test with seed:'+seed, function (t) {
    var tick = createSimulator(seed, log, events)

    var network = {}
    var alice = network['alice'] = tick.createPeer('alice')
    var bob = network['bob'] = tick.createPeer('bob')
    var carl = network['carl'] = tick.createPeer('carl')
    var dawn = network['dawn'] = tick.createPeer('dawn')

    alice.state.timeout = bob.state.timeout = dawn.state.timeout = 1
    alice.init({})
    bob.init({})
    carl.init({})
    dawn.init({})

    alice.append({author: 'alice', sequence: 1, content: {}})
    bob.append({author: 'alice', sequence: 1, content: {}})
    carl.append({author: 'alice', sequence: 1, content: {}})
    dawn.append({author: 'alice', sequence: 1, content: {}})

    alice.append({author: 'alice', sequence: 2, content: {}})
    alice.append({author: 'alice', sequence: 3, content: {}})
    bob.append({author: 'bob', sequence: 1, content: {}})

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

    //iterate while dawn and carl are behind...
    while((
      (!dawn.store.alice || dawn.store.alice.length < 2)
      && (!carl.store.alice || carl.store.alice.length < 2)
    ) && tick(network))
      ;

    //carl stalls, but the rest of the peers
    //contiue functioning correctly.
    //this lets us check the network continues
    //to work even if some peers stop.
    carl.state.stalled = true

//    bob.state.peers.alice.replicating.alice.rx = false
//    dawn.state.peers.bob.replicating.alice.rx = false
//    bob.state.peers.carl.replicating.alice.rx = true
//    dawn.state.peers.carl.replicating.alice.rx = true

//    bob.state.peers.alice.notes = null
//    dawn.state.peers.bob.notes = null

    //then continue running the simulation, including timeout
    tick.log()
    tick.output.splice(0, tick.output.length)
    console.log(JSON.stringify(bob.state, null, 2))
    console.log(JSON.stringify(dawn.state, null, 2))
//    console.log(tick.ts())
//    console.log("CONTINUE")
//    return t.end()
    tick.run(network)

  //    while(tick(network));

    tick.log()

//    return t.end()

    t.deepEqual(dawn.store, alice.store, 'dawn matches alice')
    t.deepEqual(bob.store, alice.store, 'bob matches alice')
    t.notDeepEqual(carl.store, alice.store, 'carl has stalled, does not match alice')

    t.end()
  })
}

var seed = process.argv[2]
if(isNaN(seed))
  for(var i = 0; i < 100; i++) createTest(i)
else createTest(+seed, true)









