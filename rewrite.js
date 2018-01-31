
function isFeed (id) {
  return 'string' === typeof id
}

function isPositiveInteger (int) {
  return int >= 0 && Number.isInteger(int)
}

var isInteger = Number.isInteger

function isObject(o) {
  return o && 'object' === typeof o
}

function assertKeys(obj, keyAssert, valueAssert) {
  for(var k in obj) {
    keyAssert(k); valueAssert(obj[k])
  }
}

function _assert(fn, msg) {
  return function (value) {
    assert.ok(fn(value), msg)
  }
}

exports.validate = function (state) {
  assert.ok(isObject(state.clock), 'state has clock object')
  assert.ok(isObject(state.connections), 'state has connections object')
  assertKeys(state.clock,
    _assert(isFeed, 'clock key is feed id'),
    _assert(isPositiveInteger, 'clock value is positive integer')
  )
  assertKeys(state.connections,
    _assert(isFeed, 'clock key is feed id'),
    _assert(function (con) {
      assertKeys(con.clock,
        _assert(isFeed, 'connection.clock key is feed id'),
        _assert(isInteger, 'connection.clock value is integer')
      )
      assert.ok(Array.isArray(con.msgs), 'connection.msgs is array')
      assertKeys(con.notes,
        _assert(ref.isFeed, 'connection.notes key is feed id'),
        _assert(isInteger, 'connection.notes value is integer')
      )

      //TODO check that notes are in sync with other data structures.

      for(var id in con.notes) {
        var c = state.clock[id], n = con.notes[id], f = state.following[id]
        if(!(n == f ? ( c == null ? 0 : state.replicating[id].rx ? c : ~c ) : -1)) {
          throw new Error('incorrect notes: '+id+':'+n+', clock:'+c+', following:'+f, ', receive:'+state.replicating[id].rx)
        }
      }

      return true
    }, 'connection value is correct')
  )
}

exports.events = {}

exports.events.initialize = function () {
  return {
    clock: null,
    follows: {},
    peers: {},
    receive: []
  }
}

exports.events.clock = function (state, clock) {
  state.clock = clock

  return state
}

exports.events.connect = function (state, ev) {
  if(state.peers[ev.id]) throw new Error('already connected to peer:'+ev.id)
  state.peers[ev.id] = {
    clock: null,
    msgs: [],
    receive: [], retrive: [],
    notes: null,
    replicating: {}
  }
  return state
}

exports.events.peerClock = function (state, ev) {
  if(!state.peers[ev.id])
    throw new Error('peerClock called for:'+ev.id + ' but only connected to:'+ Object.keys(state.peers))
  var peer = state.peers[ev.id]
  var clock = peer.clock = ev.value

  //iterate over following and create replications.

  //if we want to replicate a peer that has changed since their clock,
  //create a replication for that peer.

  for(var id in state.follows) {
    if(clock[id] == null || clock[id] != state.clock[id]) {
      peer.notes = peer.notes || {}
      peer.replicating = peer.replicating || {
        tx: false, rx: true, sent: null
      }
      peer.notes[id] = state.clock[id] || 0
    }
  }

  return state
}

exports.events.follow = function (state, ev) {
  if(state.follows[ev.id] !== ev.value) {
    state.follows[ev.id] = ev.value
    for(var id in state.peers) {
      var peer = state.peers[id]
      //cases:
      //  don't have feed
      //  do have feed
      //  peer has feed
      //  peer rejects feed
      if(peer.clock) {
        if(peer.clock[ev.id] === -1) {
          //peer explicitly does not replicate this feed, don't ask for it.
        }
        else if(ev.value === false) { //unfollow
          peer.notes = peer.notes || {}
          peer.notes[ev.id] = -1
          if(peer.replicating[ev.id])
            peer.replicating[ev.id].rx = false
        }
        else if(ev.value === true) {
          peer.replicating[ev.id] = {
            rx: true, tx: null,
            sent: -1
          }
          peer.notes = peer.notes || {}
          peer.notes[ev.id] = state.clock[ev.id] || 0
        }
      }
    }
  }
  return state
}

exports.events.retrive = function (state, msg) {
  //check if any peer requires this msg
  for(var id in state.peers)
    var rep = state.peers[id].replicating[msg.author]
    if(rep && rep.tx && rep.sent + 1 == msg.sequence) {
      rep.sent ++
      state.peers[id].msgs.push(msg)
      if(rep.sent < state.clock[msg.author])
        state.peers[id].retrive.push(msg.author)
    }
  return state
}

exports.events.append = function (state, msg) {
  //check if any peer requires this msg
  if(state.clock[msg.author] != null && state.clock[msg.author] + 1 != msg.sequence) return state //ignore

  state.clock[msg.author] = msg.sequence

  for(var id in state.peers) {
    var peer = state.peers[id]
    var rep = peer.replicating[msg.author]
    if(rep.tx && rep.sent+1 == msg.sequence) {
      peer.msgs.push(msg)
      rep.sent++
    }
    //if we are ahead of this peer, and not in tx mode, let them know that.
    else if(!rep.tx && msg.sequence > peer.clock[msg.author]) {
      peer.notes = peer.notes || {}
      peer.notes[msg.author] = ~msg.sequence
    }
  }

  return state
}

exports.events.receive = function (state, ev) {
  var msg = ev.value
  //receive a message, validate and append.
  //if this message is forked, disable this feed

  //if this message has already been seen, ignore.
  if(state.clock[msg.author] > msg.sequence) {
    var peer = state.peers[ev.id]
    if(peer.replicating[msg.author] && peer.replicating[msg.author].rx) {
      peer.notes = peer.notes || {}
      peer.notes[msg.author] = -clock[msg.author]
      peer.replicating[msg.author].rx = false
    }
    return state
  }

  //we _know_ that this peer is upto at least this message now.
  //(but maybe they already told us they where ahead further)
  state.peers[ev.id].clock[msg.author] = Math.max(state.peers[ev.id].clock[msg.author], msg.sequence)

  state.receive.push(msg)

  //Q: possibly update the receiving mode?

  return state
}

exports.events.notes = function (state, ev) {
  //update replicating modes
  var clock = ev.value
  var peer = state.peers[ev.id]
  for(var id in clock) {
    var seq = clock[id]
    peer.clock[id] = seq
    //check if we are not following this feed.
    if(!state.follows[id]) {
      peer.notes = peer.notes || {}
      peer.notes[id] = -1
    }
    else {
      if(!peer.replicating[id])
        peer.replicating[id] = {tx: true, rx: true, sent: seq}

      //positive seq means "send this to me please"
      peer.replicating[id].tx = seq >= 0

      //in the case we are already ahead, get ready to send them messages.      
      if(seq >= 0 && state.clock[id] > seq) {
        peer.replicating[id].sent = seq
        peer.retrive.push(id)
      }

    }
  }
  return state
}

