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

  state = events.connect(state, {id: 'bob', ts: 1})
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
//test if receive fork while connected to other peers (broadcast to them)
//test if receive request note while already know a fork (let them know it's forked)

test('test if receive fork proof while receiving messages', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: {alice: true,  bob: true}, blocks: {},
    peers: {},
    timeout: 1
  }

  state = events.connect(state, {id: 'bob', ts: 1})
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

  state = events.connect(state, {id: 'bob', ts: 1})
  state = events.connect(state, {id: 'charles', ts: 1})
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

test('test if we know fork proof, then someone asks for it', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: {alice: true,  bob: true}, blocks: {},
    peers: {},
    timeout: 1
  }

  var fork_proof = [{author: 'alice'}]
  //if we received the fork from bob, then we wouldn't send it back.
  //so say we received it from charles
  state = events.fork(state, {id: 'charles', value: fork_proof})
  t.ok(state.forked.alice)

  state = events.connect(state, {id: 'bob', ts: 1})
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

