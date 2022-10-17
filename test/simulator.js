/* eslint-disable camelcase */
const RNG = require('rng')

let log

module.exports = function (seed, _log, _events) {
  if (!_events) _events = require('../events')(require('../v3'))
  log = _log
  const rng = new RNG.MT(seed || 0)

  const events = {}

  for (const k in _events) {
    (function (fn, k) {
      events[k] = function (state, value) {
        if (log) console.log(k.toUpperCase() + '(' + state.id + ')', value)
        return fn(state, value)
      }
    })(_events[k], k)
  }

  const output = []
  let ts = 0

  function createPeer (id, validate) {
    validate = validate || function () {}
    let store = {}
    let state = events.initialize(id)
    let ts = 0
    const pClock = {}

    const self = {
      id,
      clocks: pClock,
      store,
      state,
      retriving: [],
      init: function (_store) {
        self.store = store = _store
        const clock = {}
        for (const k in store) { clock[k] = store[k].length }
        state = events.clock(state, clock)
      },
      connect: function (other) {
        state = events.connect(state, { id: other.id, ts: ++ts, client: true })
        state = events.peerClock(state, { id: other.id, value: pClock[other.id] || {}, ts: ++ts })
        other.state = events.connect(other.state, { id: this.id, ts: ++ts, client: false })
        other.state = events.peerClock(other.state, { id, value: other.clocks[id] || {}, ts: ++ts })
      },
      disconnect: function (other) {
        pClock[other.id] = state.peers[other.id].clock
        other.clocks[id] = other.state.peers[id].clock

        state = events.disconnect(state, { id: other.id, ts: ++ts })
        other.state = events.disconnect(other.state, { id: this.id, ts: ++ts })
      },
      follow: function (peer, value) {
        state = events.follow(state, { id: peer, value: value !== false, ts: ++ts })
      },
      append: function (msg) {
        const ary = store[msg.author] = store[msg.author] || []
        if (msg.sequence === ary.length + 1) {
          validate(store[msg.author], msg)
          ary.push(msg)
          state = events.append(state, msg)
        }
      }
    }

    return self
  }

  function shuffle (ary) {
    for (let i = 0; i < ary.length; i++) {
      const j = ~~(rng.random() * ary.length)
      const tmp = ary[i]
      ary[i] = ary[j]
      ary[j] = tmp
    }
    return ary
  }

  function randomFind (obj, iter) {
    if (!iter) iter = function (key, fn) { return fn() }
    if (!obj) throw new Error('obj not provided')

    const keys = shuffle(Object.keys(obj))
    for (let i = 0; i < keys.length; i++) { if (iter(keys[i], obj[keys[i]])) return true }

    return false
  }

  function tick (network) {
    return randomFind(network, function (id, peer) {
      // database ops
      if (peer.state.stalled) return
      return randomFind([function () {
        // append(receive), retrive, retrive_cb
        return randomFind([function () {
          return randomFind(peer.state.peers, function (key, p2p) {
            if (!p2p.clock) {
              peer.state = events.peerClock(peer.state, { id: key, value: {}, ts: ++ts })
              return true
            }
          })
        }, function () {
          if (peer.state.receive.length) {
            const ev = peer.state.receive.shift()
            try {
              peer.append(ev.value)
            } catch (err) {
              peer.state = events.block(peer.state, { id: ev.value.author, target: ev.id, value: true })
              return peer.state
            }
            return true
          }
        }, function () {
          return randomFind(peer.state.peers, function (key, p2p) {
            // randomly order, to simulate async
            p2p.retrive = shuffle(p2p.retrive)
            if (p2p.retrive.length) {
              const peer_id = p2p.retrive.shift()
              // it's possible that two peers need to retrive the same message at the same time
              // this may mean that the retrival is queued twice.
              const rep = p2p.replicating[peer_id]
              if (rep.tx && rep.sent < peer.state.clock[peer_id]) {
                const msg = peer.store[peer_id][rep.sent]
                if (msg == null) {
                  throw new Error('null msg!, clock:' + peer.state.clock[peer_id] + ', id:' + peer_id)
                }
                peer.retriving.push(msg)
              }
              return true
            }
          })
        }, function () {
          if (peer.retriving.length) {
            peer.retriving = shuffle(peer.retriving)
            peer.state = events.retrive(peer.state, peer.retriving.shift())
            return true
          }
        }])
      }, function () { // network ops
        return randomFind(peer.state.peers, function (remote_id, remote) {
          if (remote.notes) {
            const notes = remote.notes
            remote.notes = null
            network[remote_id].state =
              events.notes(network[remote_id].state, { id, value: notes, ts: ++ts })
            output.push({ from: id, to: remote_id, value: notes, msg: false })
            return true
          } else if (remote.msgs.length) {
            output.push({ from: id, to: remote_id, value: remote.msgs[0], msg: true })
            network[remote_id].state =
              events.receive(network[remote_id].state, { id, value: remote.msgs.shift(), ts: ++ts })
            return true
          }
        })
      }])
    })
    // TODO: test random network connections.
  }

  tick.createPeer = createPeer
  tick.output = output

  tick.log = function () {
    console.log(
      tick.output.map(function (e) {
        if (e.msg) return e.from + '>' + e.to + ':' + e.value.author[0] + e.value.sequence
        else return e.from + '>' + e.to + ':' + JSON.stringify(e.value)
      }).join('\n')
    )
  }

  tick.ts = function (_ts) {
    ts += (_ts | 0)
    return ts
  }

  tick.run = function (network) {
    let loop = 1; let first = true
    while (loop) {
      loop = 0
      while (tick(network)) loop++
      if (loop || first) {
        for (const k in network) { network[k].state = events.timeout(network[k].state, { ts: ts++ }) }
        if (first) loop = 1
        first = false
      }
    }
  }

  return tick
}
