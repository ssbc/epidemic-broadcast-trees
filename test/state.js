var states = require('../state')
var tape = require('tape')


tape('receiveMessage 1', function (t) {

  var local = {alice: 2}

  var msg = {sequence: 3, author: 'alice', content: 'blah'}

  var _state = states.receiveMessage({
    receiving: true, local: local,
  }, msg)

  t.deepEqual(_state, { receiving: true, local: local, received: 3, effect: {action: 'append', value: msg} })

  t.end()
})

//we can be ahead, behind, or in sync with the remote
//we can also be sending, receiving, idle (neither), or both.
//but if both, normally one will ask to stop receiving soon.

/*
  sending:
    +n+1
      they are ahead, ask to receive.
      this might happen on initial connections, if they think you might be further ahead.
      they have asked us to send, but they'll probably change their mind. +send +receive
    +n
      we are in sync, and neither knows who is closer to the source.
      since the actual receiver does not. +send
    +n-1
      they are behind us, get the next item for them. +send !get

    -(n+1)
      they are ahead of us, stop sending.
      ask to receive from them (but they don't want anything from us) -send +receive
    -n
      stop sending, we know they are in sync, so no need to send notes. -send
    -(n-1)
      stop sending, but send notes sometimes. -send

  receiving:
    +n+1
      they ask to receive from us, but we are not up to there.
      *enable send* I guess, but don't expect to send. +send
    +n
      they ask to receive from us, but we are already in sync.
      send a note to let the know we are in sync, if we havn't already.
    +(n-1)
      they ask to receive, but are behind us. +send

    -(n+1)
      expect them still to send to us, though. -send
    -(n)
      they just let us know we are in sync
    -(n-1)
      they are behind us, but are still getting messages faster than they would from us.
      get ready to send a note about where we are up to.

  if the absolute value is greater, and we are not already receiving, ask to receive.
  else if positive, turn on send (and get ready if we have something)
  else if negative, turn off send.
*/

tape('receiveNote, remote requests for sequence we have', function (t) {

  var local = {alice: 2}

  var state = {
    local: local, sending: false
  }

  var _state = states.receiveNote(state, {id: 'alice', seq: 2})

  t.ok(_state.sending)
  t.equal(_state.received, 2)
  t.notOk(_state.effect) //no effect, because we don't have a message for them yet!
  t.end()

})

tape('receiveNote, remote requests for sequence we are past', function (t) {

  var local = {alice: 2}

  var state = {
    local: local, sending: false
  }

  var _state = states.receiveNote(state, {id: 'alice', seq: 1})

  t.ok(_state.sending)
  t.equal(_state.received, 1)
  t.deepEqual(_state.effect, {action: 'get', value: {id: 'alice', seq: 2}})

  t.end()

})

tape('receiveNote, remote requests unrequests message we are sending', function (t) {
  var local = {alice: 2}

  var state = {
    local: local, sending: true, receiving: false
  }

  var _state = states.receiveNote(state, {id: 'alice', seq: -2})

  t.notOk(_state.sending)
  t.equal(_state.received, 2)
  t.notOk(_state.effect)

  t.end()

})

tape('receiveNote, remote requests unrequests message when we are not sending', function (t) {
  var local = {alice: 2}

  var state = {
    local: local, sending: false, receiving: false
  }

  var _state = states.receiveNote(state, {id: 'alice', seq: -2})

  t.notOk(_state.sending)
  t.equal(_state.received, 2)
  t.notOk(_state.effect)

  t.end()

})










