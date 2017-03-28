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
  t.equal(state.local.tx, false, 'since we are behind, we should not transmit')
  t.equal(state.remote.tx, true, 'since remote is ahead, they should transmit')

  var _state = states.receiveMessage(clone(state), msg)

  t.deepEqual(_state, {
    local: {seq: 2, req: 2, tx: false},
    remote: {seq: 3, req: 10, tx: true},
    ready: null,
    effect: msg
  })

  _state.effect = null //assume this was appended

  _state = states.appendMessage(_state, msg)

  t.deepEqual(_state, {
    local: {seq: 3, req: 2, tx: false},
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
  t.equal(state.local.tx, true, 'transmit because we are ahead')
  t.equal(state.remote.tx, false, 'since remote is behind, they should not transmit')

  t.deepEqual(state, {
    local: {seq: 10, req: 10, tx: true},
    remote: {seq: null, req: 2, tx: false},
    ready: null,
    effect: 3
  })

  state.effect = null //assume this was retrival

  state = states.gotMessage(clone(state), msg)

  t.deepEqual(state, {
    local: {seq: 10, req: 10, tx: true},
    remote: {seq: null, req: 2, tx: false},
    ready: msg,
    effect: null
  })

  var data = state.ready //the data to send.
  state = states.read(state) //hmm, or better symetry if read leaves ready?

  t.deepEqual(state, {
    local: {seq: 10, req: 10, tx: true},
    remote: {seq: 3, req: 2, tx: false},
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

  t.deepEqual(state, {
    local: {seq: 3, req: 2, tx: true},
    remote: {seq: null, req: 2, tx: true},
    ready: msg,
    effect: null
  })

  //the message is sent.
  state = states.read(state)

  t.equal(state.null)
  t.equal(state.remote.seq, 3)

  //but they send the same message at the same time.
  state = states.receiveMessage(state, msg)
  t.deepEqual(state, {
    local: {seq: 3, req: 2, tx: true},
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

//start in sync, receive a message (turn off transmit), append, emit a note, get requested back into tx

tape('init, receiveNote(sync), receiveMessage, read(note), receiveNote', function (t) {
  var state = states.init(2)
  var msg = {sequence: 3, author: 'alice', content: 'blah'}
  var msg2 = {sequence: 4, author: 'alice', content: 'hahaha'}

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

  //but they send the same message at the same time.
  state = states.receiveMessage(state, msg)
  t.deepEqual(state, {
    local: {seq: 2, req: 2, tx: false},
    remote: {seq: 3, req: 3, tx: true},
    ready: null,
    effect: msg
  })

  //assume this has been appended
  state.effect = null

  //we are now NOT tranmitting, so if we receive the next message on another connection,
  //we should send a note for it.

  state = states.appendMessage(state, msg2)

  t.deepEqual(state, {
    local: {seq: 4, req: 2, tx: false},
    remote: {seq: 3, req: 3, tx: true},
    ready: 4,
    effect: null
  })

  state = states.read(state)

  t.deepEqual(state, {
    local: {seq: 4, req: 4, tx: false},
    remote: {seq: 3, req: 3, tx: true},
    ready: null,
    effect: null
  })

  //then, lets say the other peer hasn't seen this message.
  //they don't actually know we are not in tx mode
  //but they see a message they don't know, so they ask for it.
  //TODO test this the other way around!

  //they havn't seen 4, so they just remind us they are only up to 3
  state = states.receiveNote(state, 3)

  t.deepEqual(state, {
    local: {seq: 4, req: 4, tx: true},
    remote: {seq: 3, req: 3, tx: true},
    ready: null,
    effect: 4
  })

  t.end()
})


//the other peer decides to turn off tx,
//but then sends a new note, so we rerequest.

tape('init, receiveNote(sync), appendMessage, read, receiveNote!', function (t) {
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

  t.deepEqual(state, {
    local: {seq: 3, req: 2, tx: true},
    remote: {seq: null, req: 2, tx: true},
    ready: msg,
    effect: null
  })

  //the message is sent.
  state = states.read(state)

  t.equal(state.null)
  t.equal(state.remote.seq, 3)

  //but they send the same message at the same time.
  state = states.receiveNote(state, 4)
  t.deepEqual(state, {
    local: {seq: 3, req: 2, tx: true},
    //maybe this really ought to be tx:false
    remote: {seq: 3, req: 4, tx: true},
    ready: 3,
    effect: null
  })

  state = states.read(state)
  t.deepEqual(state, {
    local: {seq: 3, req: 3, tx: true},
    remote: {seq: 3, req: 4, tx: true},
    ready: null,
    effect: null
  })

  t.end()
})

tape('init, receiveNote(sync), appendMessage, read, receiveNote!', function (t) {
  var state = states.init(2)
  var msg = {sequence: 3, author: 'alice', content: 'blah'}
  var msg2 = {sequence: 4, author: 'alice', content: 'whatever'}

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

  t.deepEqual(state, {
    local: {seq: 3, req: 2, tx: true},
    remote: {seq: null, req: 2, tx: true},
    ready: msg,
    effect: null
  })

  //the message is sent.
  state = states.read(state)

  t.equal(state.null)
  t.equal(state.remote.seq, 3)

  //but they send the same message at the same time.
  state = states.receiveNote(state, 4)
  t.deepEqual(state, {
    local: {seq: 3, req: 2, tx: true},
    //maybe this really ought to be tx:false
    remote: {seq: 3, req: 4, tx: true},
    ready: 3,
    effect: null
  })

  //BUT, before it can be sent, the same message is appended!

  state = states.appendMessage(state, msg2)

//  state = states.read(state)
  t.deepEqual(state, {
    local: {seq: 4, req: 2, tx: true},
    remote: {seq: 3, req: 4, tx: true},
    ready: null,
    effect: null
  })

  t.end()
})


