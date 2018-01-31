
var events = require('../../rewrite').events
var RNG = require('rng')

var log

for(var k in events) (function (fn, k) {
  events[k] = function (state, value) {
    if(log) console.log(k.toUpperCase(), value)
    return fn(state, value)
  }
})(events[k],k)

module.exports = function (seed, _log) {
log = _log = true
var rng = new RNG.MT(seed || 0)


function createPeer(id) {
  var store = {}, state = events.initialize(), self
  return self = {
    id: id,
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
      other.state = events.connect(other.state, {id: this.id})
    },
    follow: function (peer, value) {
      state = events.follow(state, {id: peer, value: value !== false})
    },
    append: function (msg) {
      if(msg.sequence == 1) {
        if(store[msg.author]) throw new Error('already has author:'+msg.author)
        store[msg.author] = [msg]
      }
      else if(msg.sequence != store[msg.author].length+1)
        throw new Error('expected msg: '+msg.author+':'+(store[msg.author].length +1)+ ' but got:'+msg.sequence)
      else
        store[msg.author].push(msg)

      state = events.append(state, msg)
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
  return ary.sort(function () { return rng.random() - 0.5 })
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
            var msg = peer.store[peer_id][p2p.replicating[peer_id].sent]
            peer.retriving.push(msg)
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
        if(remote.msgs.length) {
          network[remote_id].state =
            events.receive(network[remote_id].state, {id: id, value: remote.msgs.shift() })
          return true
        }
        else if(remote.notes) {
          var notes = remote.notes
          remote.notes = null
          network[remote_id].state =
            events.notes(network[remote_id].state, {id: id, value: notes})
          return true
        }
      })
    }])
  })
  //TODO: test random network connections.
}

  tick.createPeer = createPeer
  return tick

}

