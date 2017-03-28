var states = require('../state')
var tape = require('tape')
var u = require('../util')

function clone (obj) {
  return JSON.parse(JSON.stringify(obj))
}

tape('receiveMessage 1', function (t) {

  var msg = {sequence: 3, author: 'alice', content: 'blah'}

  var _state = states.receiveMessage({
    receiving: true, local: 2,
  }, msg)

  t.deepEqual(_state, { receiving: true, local: 2, received: 3, effect: {action: 'append', value: msg} })

  t.end()
})

//we can be ahead, behind, or in sync with the remote
//we can also be sending, receiving, idle (neither), or both.
//but if both, normally one will ask to stop receiving soon.

tape('receiveNote, remote requests for sequence we have', function (t) {

  var state = {
    local: 2, sending: false
  }

  var _state = states.receiveNote(state, 2)

  t.ok(_state.sending)
  t.equal(_state.received, 2)
  t.notOk(_state.effect) //no effect, because we don't have a message for them yet!
  t.end()

})

tape('receiveNote, remote requests for sequence we are past', function (t) {

  var state = {
    local: 2, sending: false
  }

  var _state = states.receiveNote(state, 1)

  t.ok(_state.sending)
  t.equal(_state.received, 1)
  t.deepEqual(_state.effect, {action: 'get', value: 2})

  t.end()

})

tape('receiveNote, remote requests unrequests message we are sending', function (t) {
  var state = {
    local: 2, sending: true, receiving: false
  }

  var _state = states.receiveNote(state, -2)

  t.notOk(_state.sending)
  t.equal(_state.received, 2)
  t.notOk(_state.effect)

  t.end()

})

tape('receiveNote, remote requests unrequests message when we are not sending', function (t) {
  var state = {
    local: 2, sending: false, receiving: false
  }

  var _state = states.receiveNote(state, -2)

  t.notOk(_state.sending)
  t.equal(_state.received, 2)
  t.notOk(_state.effect)

  t.end()

})

