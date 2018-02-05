
var events = require('./events')
var RNG = require('rng')

var log

for(var k in events) (function (fn, k) {
  events[k] = function (state, value) {
    if(log) console.log(k.toUpperCase()+'('+state.id+')', value)
    return fn(state, value)
  }
})(events[k],k)

module.exports = function (seed, _log) {
log = _log
var rng = new RNG.MT(seed || 0)

var output = []

function createPeer(id) {
  var store = {}, state = events.initialize(id), self
  var pClock = {}
  return self = {
    id: id,
    clocks: pClock,
    store: store,
    state: state,
    retriving: [],
    init: function (_store) {
      self.store = store = _store
      var clock = {}
      for(var k in store)
        clock[k] = store[k].length
      state = events.clock(state, clock)
    },
    connect: function (other) {
      state = events.connect(state, {id: other.id})
      state = events.peerClock(state, {id: other.id, value: pClock[other.id] || {}})
      other.state = events.connect(other.state, {id: this.id})
      other.state = events.peerClock(other.state, {id: id, value: other.clocks[id] || {}})
    },
    disconnect: function (other) {
      pClock[other.id] = state.peers[other.id].clock
      other.clocks[id] = other.state.peers[id].clock

      state = events.disconnect(state, {id: other.id})
      other.state = events.disconnect(other.state, {id: this.id})
    },
    follow: function (peer, value) {
      state = events.follow(state, {id: peer, value: value !== false})
    },
    append: function (msg) {
      var ary = store[msg.author] = store[msg.author] || []
      if(msg.sequence === ary.length + 1) {
        ary.push(msg)
        state = events.append(state, msg)
      }
    }
  }
}

function randomKey (obj) {
  var keys = Object.keys(obj)
  return keys[~~(keys.length*rng.random())]
}

function random () {
  return rng.random()
}

function shuffle (ary) {
  for(var i = 0; i < ary.length; i++) {
    var j = ~~(rng.random()*ary.length)
    var tmp = ary[i]
    ary[i] = ary[j]
    ary[j] = tmp
  }
  return ary
}

function randomFind(obj, iter) {
  if(!iter) iter = function (key, fn) { return fn() }
  if(!obj) throw new Error('obj not provided')

  var keys = shuffle(Object.keys(obj))
  for(var i = 0; i < keys.length; i++)
    if(iter(keys[i], obj[keys[i]])) return true

  return false
}

function tick (network) {
  return randomFind(network, function (id, peer) {
    //database ops
    return randomFind([function () {
      //append(receive), retrive, retrive_cb
      return randomFind([function () {
        return randomFind(peer.state.peers, function (key, p2p) {
          if(!p2p.clock) {
            peer.state = events.peerClock(peer.state, {id: key, value: {}})
            return true
          }
        })
      }, function () {
        if(peer.state.receive.length) {
          var msg = peer.state.receive.shift()
          peer.append(msg)
          return true
        }
      }, function () {
        return randomFind(peer.state.peers, function (key, p2p) {
          //randomly order, to simulate async
          p2p.retrive = shuffle(p2p.retrive)
          if(p2p.retrive.length) {
            var peer_id = p2p.retrive.shift()
            //it's possible that two peers need to retrive the same message at the same time
            //this may mean that the retrival is queued twice.
            var rep = p2p.replicating[peer_id]
            if(rep.tx && rep.sent < peer.state.clock[peer_id]) {
              var msg = peer.store[peer_id][rep.sent]
              if(msg == null) {
                throw new Error('null msg!, clock:'+peer.state.clock[peer_id]+ ', id:'+peer_id)
              }
              peer.retriving.push(msg)
            }
            return true
          }
        })
      }, function () {
        if(peer.retriving.length) {
          peer.retriving = shuffle(peer.retriving)
          peer.state = events.retrive(peer.state, peer.retriving.shift())
          return true
        }
      }])
    }, function () { //network ops
      return randomFind(peer.state.peers, function (remote_id, remote) {
        if(remote.notes) {
          var notes = remote.notes
          remote.notes = null
          network[remote_id].state =
            events.notes(network[remote_id].state, {id: id, value: notes})
          output.push({from: id, to: remote_id, value: notes, msg: false})
          return true
        }
        else if(remote.msgs.length) {
          output.push({from: id, to: remote_id, value: remote.msgs[0], msg: true})
          network[remote_id].state =
            events.receive(network[remote_id].state, {id: id, value: remote.msgs.shift() })
          return true
        }
      })
    }])
  })
  //TODO: test random network connections.
}
  tick.createPeer = createPeer
  tick.output = output

  tick.log = function () {
    console.log(
      tick.output.map(function (e) {
        if(e.msg)
          return e.from+'>'+e.to+':'+e.value.author[0]+e.value.sequence
        else
          return e.from+'>'+e.to+':'+JSON.stringify(e.value)
      }).join('\n')
    )
  }
  return tick
}

