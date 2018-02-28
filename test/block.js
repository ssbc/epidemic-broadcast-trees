
var test = require('tape')

var events = require('../events')(require('./options'))

var note = events.note

test('blocks', function (t) {

  var state = events.initialize('alice')

  state.clock = {alice: 3, charles: 3, dawn: 3}

  state = events.follow(state, {id: 'alice', value: true})
  state = events.follow(state, {id: 'charles', value: true})
  state = events.follow(state, {id: 'dawn', value: true})

  state = events.block(state, {id: 'alice', target: 'bob', value: true})
  t.deepEqual(state.blocks, {alice: {bob:true}})
  state = events.block(state, {id: 'alice', target: 'bob', value: false})
  t.deepEqual(state.blocks, {})

  //do not allow connection to someone we block.
  state = events.block(state, {id: 'alice', target: 'bob', value: true})
  state = events.block(state, {id: 'charles', target: 'dawn', value: true})
  console.log(state)
  state = events.connect(state, {id: 'bob'})

  t.deepEqual(state.peers, {})

  state = events.connect(state, {id: 'dawn', client: false})

  state = events.peerClock(state, {id: 'dawn', value:{}})

  //charles has blocked dawn, so do not give dawn charle's messages
  t.deepEqual(state.peers.dawn.notes, {
    alice: note(3, true), dawn: note(3, true)
  })

  //but dawn asks for charles anyway.
  state = events.notes(state, {id: 'dawn', value: {
    alice: note(2, true), dawn: note(2, true), charles: note(1, true)
  }})

  //charles has blocked dawn, so do not give dawn charles' messages
  t.deepEqual(state.peers.dawn.notes, {
    alice: note(3, true), dawn: note(3, true), charles: note(-1, false)
  })

  t.end()

})


