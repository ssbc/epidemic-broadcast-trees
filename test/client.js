var test = require('tape')

var events = require('../events')(require('./options'))

var note = events.note

test('client does not send {} until received it', function (t) {
  var state = events.initialize('alice')
  state = events.connect(state, {id: 'bob', client: true})
  state.follows = {alice: true, bob: true}
  state.clock = {alice:1, bob: 1}
  state = events.peerClock(state, {id: 'bob', value: {}})
  t.equal(state.peers.bob.notes, null)
  state = events.notes(state, {id: 'bob', value: {}})
  t.deepEqual(state.peers.bob.notes, {alice: note(1, true), bob: note(1, true)})

  state.peers.bob.notes = null

  t.end()
})

test('client does not send {} until received it, but will send empty note, one time', function (t) {
  var state = events.initialize('alice')
  state = events.connect(state, {id: 'bob', client: true})
  state = events.peerClock(state, {id: 'bob', value: {}})
  t.equal(state.peers.bob.notes, null)
  state = events.notes(state, {id: 'bob', value: {}})
  t.deepEqual(state.peers.bob.notes, {})
  t.end()
})
