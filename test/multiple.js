
var test = require('tape')

var events = require('../events')


test('if connects to multiple peers, should replicate a feed from only one', function (t) {

  var state = events.initialize('alice', Date.now())
  state.follows = {
    alice: true, bob: true, charles: true
  }
  state = events.clock(state, {alice: 3, bob: 2, charles: 5})
  
  state = events.connect(state, {id: 'bob'})
  state = events.peerClock(state, {id: 'bob', value: {alice: 2, bob: 2, charles: 5}})
  state = events.connect(state, {id: 'charles', value: {alice: 2, bob: 2, charles: 5}})
  state = events.peerClock(state, {id: 'charles', value: {alice: 2, bob: 2, charles: 5}})

  console.log(state.peers)

  state = events.notes(state, {id: 'bob', value: {
    alice: 3, bob: 5, charles: 9
  }})
  state = events.notes(state, {id: 'charles', value: {
    alice: 3, bob: 4, charles: 9
  }})
  console.log(state.peers)

  //we should only request transmissions from at most one peer.


  var notes = {}
  for(var peer_id in state.peers) {
    var peer = state.peers[peer_id]
    for(var feed_id in peer.notes) {
      t.equal(peer.notes[feed_id] >= 0, peer.replicating[feed_id].rx)
      if(peer.notes[feed_id] >= 0) {
        notes[feed_id] = (notes[feed_id] || 0) + 1
      }
    }
  }

  console.log(JSON.stringify(state.peers, null, 2))

//  t.deepEqual(notes, {alice: 1, bob: 1, charles: 1})

  t.end()
})




