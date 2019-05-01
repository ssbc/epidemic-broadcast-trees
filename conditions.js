var explain = require('explain-error')
var deepEqual = require('deep-equal')
function isObject (o) {
  return o && 'object' === typeof o
}

function isEmptyArray(a) {
  return Array.isArray(a) && a.length == 0
}

function isVectorClock(clock) {
  if(!clock || !isObject(clock)) {
    isVectorClock.reason = 'clock must be an object'
    return false
  }
  for(var k in clock) {
    if(!Number.isInteger(clock[k])) {
      isVectorClock.reason = 'clock items must be integers'
      return false
    }
    if(clock[k] < 0) {
      isVectorClock.reason = 'clock items must greater than zero'
      return false
    }
  }
  return true
}

//like vector clock, except that items can be -1.
function isNotesClock(clock) {
  if(!clock || !isObject(clock)) {
    isNotesClock.reason = 'clock must be an object'
    return false
  }
  for(var k in clock) {
    if(!Number.isInteger(clock[k])) {
      isNotesClock.reason = 'clock items must be integers'
      return false
    }
    if(clock[k] < -1) {
      isNotesClock.reason = 'clock items must greater than zero'
      return false
    }
  }
  return true

}

function isBlocked(state, from, to) {
  return state.blocked && state.blocked[from] && state.blocked[from][to] || false
}

var conditions = {
  clock: {
    pre: function (state) {
      if(state.clock != null)
        throw new Error('state.clock must be null before clock event')
    },
    post: function (state) {
      if(!isVectorClock(state.clock))
        throw new Error('state.clock must be valid VectorClock, ' + isVectorClock.reason)
    }
  },
  connect: {
    pre: function (state, ev) {
      if(state.peers[ev.id] != null)
        throw new Error('peer must not already be connected')
    },
    post: function (state, ev) {
      var peer = state.peers[ev.id]
      if(!(peer.blocked == isBlocked(state, state.id, ev.id)))
        throw new Error('blocked state incorrect, expected:'+ isBlocked(state, state.id, ev.id) + ' was:'+peer.blocked)

      if(!(peer.clock == null))
        throw new Error('initial clock is null')

      if(!isEmptyArray(peer.msgs) && !isEmptyArray(peer.retrive))
        throw new Error('peer.msgs and peer.retrive must be initialized as empty arrays')

      //todo: ready (to send vector clock) set to false if we are client.

    }
  },
  disconnect: {
    post: function (state, ev) {
      if(state.peers[ev.id] != null)
        throw new Error('peer must be null after disconnect')
    }
  },
  peerClock: {
    pre: function (state, ev) {
      if(!state.peers[ev.id])
        throw new Error('must already be connected to peer')
      if(state.peers[ev.id].clock) {
        throw new Error('peer clock must not be loaded yet')
      }
    },
    post: function (state, ev) {
      var peer = state.peers[ev.id]
      if(!deepEqual(peer.clock, ev.value))
        throw new Error("peer's clock must be set")

      if(peer.replicating) {
        if(!isNotesClock(peer.notes)) {
          //the initial vector clock sent never has -1 (block)
          throw new Error('notes should be NoteClock, was: ' + JSON.stringify(peer.notes) +  ' ' + isNotesClock.reason)
        }
        for(var k in peer.notes)
          //check if we say we are replicating but
          //don't check wether we are in eager mode.
          //(we might be already replicating from another peer)
          if(peer.notes[k] >= 0 !== state.follows[k])
            throw new Error('notes must match following state:')

          //TODO: check that each feed is not requested
          //from more than one peer.
      }
    }
  },
  follow: {
    pre: function (state, ev) {


    },
    post: function (state, ev) {
      if(state.follows[ev.id] !== ev.value)
        throw new Error('did not set follow state')
      //TODO: check that this feed is requested from at least one peer (if we are connected to some peers)

    }
  },
  retrive: {
    pre: function (state, msg) {
    },
    post: function (state, msg) {
      for(var id in state.peers) {
        var peer = state.peers[id]
        var rep = peer.replicating && peer.replicating[msg.author]
        if(rep && rep.tx) {
          if(rep.sent === msg.sequence) {
            //can't check that it appended the message, because it might have _already_ appended and sent.
            //TODO: check whether append should happen in pre condition?
          }
        }
      }
    }
  },
  append: {
    pre: function (state) {
      if(!state.clock) throw new Error('clock must be ready')
    },
    post: function (state, msg) {
      if(!(state.clock[msg.author] === msg.sequence))
        throw new Error('clock was not set')

      //check that msg has been appended to any that need it.
      //and also, that any not transmitting have notes.
    }
  },
  receive: {
    pre: function (state, ev) {
      if(!state.peers[ev.id]) throw new Error('received message from unknown peer')

      //there are several possibilities for the remote
      //peer to send the wrong message here.
      //hmm, we should have preconditions for incoming
      //event?
    },
    post: function (state, ev) {
      var peer = state.peers[ev.id]
      var msg = ev.value
      var rep = peer.replicating[msg.author]
      if(!(rep.sent >= msg.sequence))
        throw new Error("peer's sent must be incremented:"+JSON.stringify(rep) + ', '+JSON.stringify(msg))
      if(!(peer.clock[msg.author] >= msg.sequence))
        throw new Error('clock must be incremented')
    }

  }
}

function check(event, prepost, state, ev) {
  if(conditions[event] && conditions[event][prepost]) {
    try {
      conditions[event][prepost](state, ev)
    }
    catch (err) {
      throw explain(err, prepost + 'condition failed for '+event+' event.')
    }
  }
}

module.exports = function (events) {
  if(events.wrapped) return events
  var _events = {wrapped: true}
  for(var k in events) (function (event) {
    _events[event] = function (state, ev) {
      check(event, 'pre', state, ev)
      state = events[event](state, ev)
      check(event, 'post', state, ev)
      return state
    }
  })(k)
  return _events
}












