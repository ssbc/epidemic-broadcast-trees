
var test = require('tape')
var events = require('../events')(require('./options'))

test('switch peers if timeout exceeded', function (t) {
  var state = {
    id: 'alice',
    clock: {bob: 5, charles: 6, dawn: 3},
    retrive: [],
    follows: {bob: true},
    timeout: 1000,
    peers: {
      bob: {
        clock: {bob: 7},
        notes: null,
        replicating: { bob: {rx: true, tx: false, sent: -1 }},
        ts: 3000
      },
      charles: {
        clock: {bob: 10},
        notes: null,
        replicating: { bob: {rx: false, tx: false, sent: -1 }}
      },
      dawn: {
        clock: {bob: 9},
        notes: null,
        replicating: { bob: {rx: false, tx: false, sent: -1 }}
      }
    }
  }

  state = events.timeout(state, {ts: 5000})

  t.equal(state.peers.bob.replicating.bob.rx, false)
  t.equal(state.peers.charles.replicating.bob.rx, true)

  console.log(JSON.stringify(state, null, 2))

  state = events.timeout(state, {ts: 10000})

  t.equal(state.peers.charles.replicating.bob.rx, false)
  t.equal(state.peers.dawn.replicating.bob.rx, true)

  state = events.timeout(state, {ts: 15000})

  t.equal(state.peers.dawn.replicating.bob.rx, false)
  t.equal(state.peers.bob.replicating.bob.rx, true)

  t.end()

})

test('if up to latest message by peer, swich if another peer claims newer', function (t) {
  var state = {
    id: 'alice',
    clock: {bob: 7, charles: 6, dawn: 3},
    retrive: [],
    follows: {bob: true},
    timeout: 1000,
    peers: {
      bob: {
        clock: {bob: 7},
        notes: null,
        replicating: { bob: {rx: true, tx: false, sent: -1 }},
        ts: 3000
      },
      charles: {
        clock: {bob: 10},
        notes: null,
        replicating: { bob: {rx: false, tx: false, sent: -1 }}
      },
      dawn: {
        clock: {bob: 9},
        notes: null,
        replicating: { bob: {rx: false, tx: false, sent: -1 }}
      }
    }
  }

  state = events.timeout(state, {ts: 5000})

  t.equal(state.peers.bob.replicating.bob.rx, false)
  t.equal(state.peers.charles.replicating.bob.rx, true)


  state = events.timeout(state, {ts: 10000})

  t.equal(state.peers.charles.replicating.bob.rx, false)
  t.equal(state.peers.dawn.replicating.bob.rx, true)

  state = events.timeout(state, {ts: 15000})

  console.log(JSON.stringify(state, null, 2))

  t.equal(state.peers.dawn.replicating.bob.rx, false)
//  t.equal(state.peers.charles.replicating.bob.rx, true)
  t.equal(state.peers.bob.replicating.bob.rx, true)

  t.end()

})


