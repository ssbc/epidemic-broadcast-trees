/* eslint-disable camelcase */

const test = require('tape')

module.exports = function (events) {
  const note = events.note

  test('if connects to multiple peers, should replicate a feed from only one', function (t) {
    let state = events.initialize('alice')
    state.follows = {
      alice: true, bob: true, charles: true
    }
    state = events.clock(state, { alice: 3, bob: 2, charles: 5 })

    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: 2, bob: 2, charles: 5 } })
    state = events.connect(state, { id: 'charles', client: false })
    state = events.peerClock(state, { id: 'charles', value: { alice: 2, bob: 2, charles: 5 } })

    console.log(state.peers)

    state = events.notes(state, {
      id: 'bob',
      value: {
        alice: note(3, true), bob: note(5, true), charles: note(9, true)
      }
    })
    state = events.notes(state, {
      id: 'charles',
      value: {
        alice: note(3, true), bob: note(4, true), charles: note(9, true)
      }
    })
    console.log(state.peers)

    // we should only request transmissions from at most one peer.
    const notes = {}
    for (const peer_id in state.peers) {
      const peer = state.peers[peer_id]
      for (const feed_id in peer.notes) {
        t.equal(events.getReceive(peer.notes[feed_id]), peer.replicating[feed_id].rx, 'implied rx state should be recorded, seq:' + peer.notes[feed_id] + ', rx=' + peer.replicating[feed_id].rx)
        if (events.getReceive(peer.notes[feed_id])) {
          notes[feed_id] = (notes[feed_id] || 0) + 1
        }
      }
    }

    console.log(JSON.stringify(state.peers, null, 2))

    t.deepEqual(notes, { alice: 1, bob: 1, charles: 1 })

    t.end()
  })
}

if (!module.parent) { module.exports(require('./options')) }
