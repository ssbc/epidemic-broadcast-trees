var states = require('../state')
var tape = require('tape')
var u = require('../util')

function clone (obj) {
  return JSON.parse(JSON.stringify(obj))
}

tape('init, receiveNote+, receiveMessage, appendMessage', function (t) {

  var msg = {sequence: 3, author: 'alice', content: 'blah'}

  var state = states.init(2)
  t.equal(state.ready, 2) //assume that a request for message 2 has been sent.

  state = states.read(state)
  
  //we learn that the remote is up to 10
  state = states.receiveNote(state, 10)

  //since when we receive their note we know we are behind
  //assume they are in tx mode, but we are not.
  t.equal(state.local.tx, true, 'since we are behind, we should not transmit')
  t.equal(state.remote.tx, true, 'since remote is ahead, they should transmit')

  var _state = states.receiveMessage(clone(state), msg)

  t.deepEqual(_state, {
    local: {seq: 2, req: 2, tx: true},
    remote: {seq: 3, req: 10, tx: true},
    ready: null,
    effect: msg
  })

  _state.effect = null //assume this was appended

  _state = states.appendMessage(_state, msg)

  t.deepEqual(_state, {
    local: {seq: 3, req: 2, tx: true},
    remote: {seq: 3, req: 10, tx: true},
    ready: null,
    effect: null
  })


  t.end()
})

tape('init, receiveNote-, getMessage, read', function (t) {

  var msg = {sequence: 3, author: 'alice', content: 'blah'}

  var state = states.init(10)
  t.equal(state.ready, 10) //assume that a request for message 2 has been sent.

  state = states.read(state)
  
  //we learn that the remote is up to 10
  state = states.receiveNote(state, 2)

  //since when we receive their note we know we are behind
  //assume they are in tx mode, but we are not.

  t.deepEqual(state, {
    local: {seq: 10, req: 10, tx: true},
    remote: {seq: null, req: 2, tx: true},
    ready: null,
    effect: 3
  })

  state.effect = null //assume this was retrival

  state = states.gotMessage(clone(state), msg)

  t.deepEqual(state, {
    local: {seq: 10, req: 10, tx: true},
    remote: {seq: null, req: 2, tx: true},
    ready: msg,
    effect: null
  })

  var data = state.ready //the data to send.
  state = states.read(state) //hmm, or better symetry if read leaves ready?

  t.deepEqual(state, {
    local: {seq: 10, req: 10, tx: true},
    remote: {seq: 3, req: 2, tx: true},
    ready: null,
    effect: 4
  })

  t.end()
})

tape('init, receiveNote(sync), appendMessage, read, receiveMessage!', function (t) {
  var state = states.init(2)
  var msg = {sequence: 3, author: 'alice', content: 'blah'}

  state = states.read(state) //in sync with remote
  t.equal(state.effect, null, 'in sync, so send nothing')
  state = states.receiveNote(state, 2)

  //if we are both in sync, then both transmit, and one of us will turn off later
  t.equal(state.local.tx, true, 'transmit because we are in sync')
  t.equal(state.remote.tx, true, 'transmit because we are both in sync')

  t.deepEqual(state, {
    local: {seq: 2, req: 2, tx: true},
    remote: {seq: null, req: 2, tx: true},
    ready: null,
    effect: null
  })

  //message is appended, as if it was created locally,
  //or received from another peer.
  state = states.appendMessage(state, msg)
  t.equal(state.effect, null)
  t.deepEqual(state, {
    local: {seq: 3, req: 2, tx: true},
    remote: {seq: null, req: 2, tx: true},
    ready: msg,
    effect: null
  })

//  return t.end()
  //the message is sent.
  state = states.read(state)

  t.equal(state.null)
  t.equal(state.remote.seq, 3)

  //but they send the same message at the same time.
  state = states.receiveMessage(state, msg)
  t.deepEqual(state, {
    local: {seq: 3, req: 3, tx: true},
    remote: {seq: 3, req: 3, tx: true},
    ready: -msg.sequence,
    effect: null
  })

  state = states.read(state)

  t.deepEqual(state, {
    local: {seq: 3, req: 3, tx: true},
    remote: {seq: 3, req: 3, tx: false},
    ready: null,
    effect: null
  })

  t.end()
})



