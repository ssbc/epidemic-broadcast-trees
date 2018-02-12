
exports.initialize = function (id) {
  return {
    id: id,
    clock: null,
    follows: {},
    peers: {},
    receive: []
  }
}

exports.clock = function (state, clock) {
  state.clock = clock

  return state
}

exports.connect = function (state, ev) {
  if(state.peers[ev.id]) throw new Error('already connected to peer:'+ev.id)
  state.peers[ev.id] = {
    clock: null,
    msgs: [],
    retrive: [],
    notes: null,
    replicating: {}
  }

  return state
}

exports.disconnect = function (state, ev) {
  delete state.peers[ev.id]
  return state
}

//this is when the stored peer clock has been loaded from the local database.
//note, this must be handled before any messages are received.
exports.peerClock = function (state, ev) {
  if(!state.peers[ev.id])
    throw new Error('peerClock called for:'+ev.id + ' but only connected to:'+ Object.keys(state.peers))
  var peer = state.peers[ev.id]
  var clock = peer.clock = ev.value

  //iterate over following and create replications.

  //if we want to replicate a peer that has changed since their clock,
  //create a replication for that peer.

  peer.notes = peer.notes || {}
  for(var id in state.follows) {
    if(state.follows[id] && clock[id] !== -1 && (clock[id] != (state.clock[id] || 0))) {
      peer.notes[id] = state.clock[id] || 0
      peer.replicating = peer.replicating || {}
      peer.replicating[id] = {
        tx: false, rx: true, sent: null
      }
    }
  }

  return state
}

exports.follow = function (state, ev) {
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
        else if(ev.value === true && peer.clock[ev.id] != (state.clock[ev.id] || 0)) {
          peer.replicating[ev.id] = {
            rx: true, tx: false,
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

exports.retrive = function (state, msg) {
  //check if any peer requires this msg
  for(var id in state.peers) {
    var rep = state.peers[id].replicating[msg.author]
    if(rep && rep.tx && rep.sent === msg.sequence - 1) {
      rep.sent ++
      state.peers[id].msgs.push(msg)
      if(rep.sent < state.clock[msg.author]) {
        //use continue, not return because we still need to loop through other peers.
        if(~state.peers[id].retrive.indexOf(msg.author)) continue
        state.peers[id].retrive.push(msg.author)
      }
    }
  }
  return state
}

exports.append = function (state, msg) {
  //check if any peer requires this msg
  if(state.clock[msg.author] != null && state.clock[msg.author] !== msg.sequence - 1) return state //ignore

  state.clock[msg.author] = msg.sequence

  for(var id in state.peers) {
    var peer = state.peers[id]
    var rep = peer.replicating[msg.author]
    if(rep && rep.tx && rep.sent == msg.sequence - 1 && msg.sequence > peer.clock[msg.author]) {
      peer.msgs.push(msg)
      rep.sent++
    }
    //if we are ahead of this peer, and not in tx mode, let them know that.
    else if(rep && !rep.tx && msg.sequence > peer.clock[msg.author]) {
      peer.notes = peer.notes || {}
      peer.notes[msg.author] = ~msg.sequence
    }
  }

  return state
}

exports.receive = function (state, ev) {
  var msg = ev.value
  //receive a message, validate and append.
  //if this message is forked, disable this feed

  if(!state.peers[ev.id]) throw new Error('lost peer state:'+ev.id)

  //we _know_ that this peer is upto at least this message now.
  //(but maybe they already told us they where ahead further)
  state.peers[ev.id].clock[msg.author] = Math.max(state.peers[ev.id].clock[msg.author], msg.sequence)
  state.peers[ev.id].replicating[msg.author].sent =
    Math.max(
      state.peers[ev.id].replicating[msg.author].sent,
      msg.sequence
    )
  //if this message has already been seen, ignore.
  if(state.clock[msg.author] > msg.sequence) {
    var peer = state.peers[ev.id]
    if(peer.replicating[msg.author] && peer.replicating[msg.author].rx) {
      peer.notes = peer.notes || {}
      peer.notes[msg.author] = -state.clock[msg.author]
      peer.replicating[msg.author].rx = false
    }
    return state
  }

  state.receive.push(msg)

  //Q: possibly update the receiving mode?

  return state
}

exports.notes = function (state, ev) {
  //update replicating modes
  var clock = ev.value
  var peer = state.peers[ev.id]
  if(!peer) throw new Error('lost state of peer:'+id)
  if(!peer.clock) throw new Error("received notes, but has not set the peer's clock yet")
  var count = 0
  for(var id in clock) {
    count ++
    var seq = clock[id]
    var _seq = seq < -1 ? ~seq : seq
    peer.clock[id] = _seq
    var lseq = state.clock[id] || 0
    //check if we are not following this feed.
    if(!state.follows[id]) {
      peer.notes = peer.notes || {}
      peer.notes[id] = -1
    }
    else {
      var rep = peer.replicating[id]
      if(!rep) {
        rep = peer.replicating[id] = {
          tx: false, //true,
          rx: false, //lseq < _seq,
          sent: _seq
        }
        peer.notes = peer.notes || {}
        peer.notes[id] = lseq == 0 ? 0 : lseq < _seq ? lseq : ~lseq
      }
      else if(!rep.rx && _seq > lseq) {
        rep.rx = true
        peer.notes = peer.notes || {}
        peer.notes[id] = lseq
        //if we shift this feed into receive mode (rx),
        //remember the time, and if we havn't received anything
        //after a timeout, request from another peer instead.
        rep.ts = ev.ts
      }
      //positive seq means "send this to me please"
      rep.tx = seq >= 0
      //in the case we are already ahead, get ready to send them messages.      
      rep.sent = _seq
      if(seq >= 0 && state.clock[id] > _seq) {
        peer.retrive.push(id)
      }
    }
  }
  peer.recvNotes = (peer.recvNotes || 0) + count
  return state
}


