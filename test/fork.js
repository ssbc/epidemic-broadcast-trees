var events = require('../events')(require('./options'))
var test = require('tape')

var note = events.note

test('test if receive fork in clock', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: {alice: true,  bob: true}, blocks: {},
    peers: {},
    timeout: 1
  }

  state = events.connect(state, {id: 'bob', ts: 1, client: false})
  /*
    loads a stored peer clock where remote still wants bob.
  */
  state = events.peerClock(state, {
    id: 'bob',
    value: {
      alice: note(0, true),
      bob: note(1, true)
    }
  })

  state = events.notes(state, {
    id: 'bob',
    value: {
      alice: -2
    }
  })

  console.log(JSON.stringify(state, null, 2))

  t.equal(state.peers.bob.clock.alice, -2)
  t.equal(state.peers.bob.replicating.alice.requested, 3)
  t.equal(state.peers.bob.replicating.alice.tx, false)
  t.equal(state.peers.bob.replicating.alice.rx, true)

  state = events.fork(state, {id: 'bob', value: [{author: 'alice'}]})

  t.ok(state.forked.alice)
//  t.equal(state.clock.alice, -2)
  //would transmit the fork to any other peers, if were connected

  t.equal(state.peers.bob.replicating.alice.rx, false)
  t.equal(state.peers.bob.replicating.alice.tx, false)

//  state = events.connect(state, {id: 'charles', ts: 2})

  t.end()
})

//Test if receive fork proof while expecting messages
//test if receive request note while already know a fork (let them know it's forked)

test('test if receive fork proof while receiving messages', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: {alice: true,  bob: true}, blocks: {},
    peers: {},
    timeout: 1
  }

  state = events.connect(state, {id: 'bob', ts: 1, client: true})
  /*
    loads a stored peer clock where remote still wants bob.
  */
  state = events.peerClock(state, {
    id: 'bob',
    value: {
      alice: note(0, true),
      bob: note(1, true)
    }
  })

  state = events.notes(state, {
    id: 'bob',
    value: {
      alice: note(2, true)
    }
  })

  t.equal(state.peers.bob.clock.alice, 2)
  t.equal(state.peers.bob.replicating.alice.requested, 3)
  t.equal(state.peers.bob.replicating.alice.tx, true)
  t.equal(state.peers.bob.replicating.alice.rx, true)

  var fork_proof = [{author: 'alice'}]
  //if we received the fork from bob, then we wouldn't send it back.
  //so say we received it from charles
  state = events.fork(state, {id: 'charles', value: fork_proof})

  t.ok(state.forked.alice)
  t.deepEqual(state.peers.bob.msgs, [fork_proof])
  t.equal(state.peers.bob.notes && state.peers.bob.notes.alice, undefined)
  //would transmit the fork to any other peers, if were connected

  t.equal(state.peers.bob.replicating.alice.tx, false)
  t.equal(state.peers.bob.replicating.alice.rx, false)

  t.end()
})

test('test if receive fork proof while receiving messages', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: {alice: true,  bob: true}, blocks: {},
    peers: {},
    timeout: 1
  }

  state = events.connect(state, {id: 'bob', ts: 1, client: true})
  state = events.connect(state, {id: 'charles', ts: 1, client: false})
  /*
    loads a stored peer clock where remote still wants bob.
  */
  state = events.peerClock(state, {
    id: 'bob',
    value: {
      alice: note(0, true),
      bob: note(1, true)
    }
  })

  state = events.notes(state, {
    id: 'bob',
    value: {
      alice: note(2, true)
    }
  })

  t.equal(state.peers.bob.clock.alice, 2)
  t.equal(state.peers.bob.replicating.alice.requested, 3)
  t.equal(state.peers.bob.replicating.alice.tx, true)
  t.equal(state.peers.bob.replicating.alice.rx, true)

  var fork_proof = [{author: 'alice'}]
  //if we received the fork from bob, then we wouldn't send it back.
  //so say we received it from charles
  state = events.fork(state, {id: 'bob', value: fork_proof})

  t.ok(state.forked.alice)
  t.deepEqual(state.peers.bob.msgs, [])
  t.equal(state.peers.bob.notes && state.peers.bob.notes.alice, undefined)
  //would transmit the fork to any other peers, if were connected

  t.equal(state.peers.bob.replicating.alice.tx, false)
  t.equal(state.peers.bob.replicating.alice.rx, false)

  t.end()
})

test('test if we know fork proof, then someone asks for it, we should send fork proof', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: {alice: true,  bob: true}, blocks: {},
    peers: {},
    timeout: 1
  }

  var fork_proof = [{author: 'alice', forked: true}]
  //if we received the fork from bob, then we wouldn't send it back.
  //so say we received it from charles
  state = events.fork(state, {id: 'charles', value: fork_proof})
  t.ok(state.forked.alice)

  state = events.connect(state, {id: 'bob', ts: 1, client: false})
  /*
    loads a stored peer clock where remote still wants bob.
  */
  state = events.peerClock(state, {
    id: 'bob',
    value: {}
  })
  t.deepEqual(state.peers.bob.notes, {alice: -2, bob: note(2, true)})

  state = events.notes(state, {
    id: 'bob',
    value: { alice: note(2, true) } //bob asks for alice, but she has forked!
  })

  //the message queue should contain exactly the fork_proof
  t.deepEqual(state.peers.bob.msgs, [fork_proof])

//  t.equal(state.peers.bob.clock.alice, 2)
//  t.equal(state.peers.bob.replicating.alice.requested, 3)
//  t.equal(state.peers.bob.replicating.alice.tx, true)
//  t.equal(state.peers.bob.replicating.alice.rx, true)


//  t.deepEqual(state.peers.bob.msgs, [fork_proof])
//  t.equal(state.peers.bob.notes && state.peers.bob.notes.alice, undefined)
//  //would transmit the fork to any other peers, if were connected
//
//  t.equal(state.peers.bob.replicating.alice.tx, false)
//  t.equal(state.peers.bob.replicating.alice.rx, false)

  t.end()
})

//test if receive fork while connected to other peers (broadcast to them)

test('test if receive fork while connect to other peers (broadcast to everyone)', function (t) {
  //alice, bob, carol are connected, all replicating frank.

  var state = {
    id: 'alice',
    clock: { frank: 1 },
    follows: {frank: true }, blocks: {},
    peers: {},
    timeout: 1
  }

  state = events.connect(state, {id: 'bob', ts: 1, client: true})
  state = events.peerClock(state, {id: 'bob', value: {frank: 1 }})
  state = events.connect(state, {id: 'carol', ts: 2, client: false})
  state = events.peerClock(state, {id: 'carol', value: {frank: 1 }})


  //we are in sync with bob
  state = events.notes(state, {id: 'bob', value: {frank: note(1, true)}})
  t.deepEqual(state.peers.bob.replicating.frank, {tx:true, rx: false, sent: 1, requested: 1})
  t.deepEqual(state.peers.carol.replicating, {}) //not replicating frank yet

  var frank2 = {author: 'frank', sequence: 2, content: 'about to fork'}
  state = events.append(state, frank2)

  console.log(state)
  t.deepEqual(state.peers.bob.msgs, [frank2])
  t.deepEqual(state.peers.carol.msgs, [])

  //receives a fork proof from bob
  var fork_proof = [{author: 'frank', forked: true}]

  state = events.fork(state, {id: 'bob', value: fork_proof})

//  t.deepEqual(state.peers.bob.msgs, [frank2])
//  t.deepEqual(state.peers.bob.msgs, [frank2])
  t.deepEqual(state.peers.carol.msgs, [])

  t.deepEqual(state.peers.carol.notes, {frank: -2})



//  state = events.fork(state, {id: 'bob', value: fork_proof})
//
//  //check we will send fo
//  t.deepEqual(state.peers.carol.msgs, []) //do not send anything yet, because we have not received clock
//
//  t.deepEqual(state.peers.carol.msgs, [fork_proof], 'send fork to carol')
//  t.deepEqual(state.forked, {frank: fork_proof})
//
//  //if daisy connects and asks for frank, just send fork proof
//  state = events.connect(state, {id: 'dan', ts: 2})
//  state = events.peerClock(state, {id: 'dan', value: {frank: note(1, true)}})
//
//  t.deepEqual(state.peers.dan.msgs, [fork_proof], 'send fork to dan')


  t.end()

})




