'use strict'

//check if a feed is already being replicated on another peer from ignore_id
function isAlreadyReplicating(state, feed_id, ignore_id) {
  for(var id in state.peers) {
    if(id !== ignore_id) {
      var peer = state.peers[id]
      if(peer.notes && peer.notes[id] >= 0) return id
      if(peer.replicating[feed_id] && peer.replicating[feed_id].rx) return id
    }
  }
  return false
}

//check if a feed is available from a peer apart from ignore_id

function isAvailable(state, feed_id, ignore_id) {
  for(var peer_id in state.peers) {
    if(peer_id != ignore_id) {
      var peer = state.peers[peer_id]
      if((peer.clock[feed_id] || 0) > (state.clock[feed_id] || 0)) {
        return true
      }
    }
  }
}

//jump to a particular key in a list, then iterate from there
//back around to the key. this is used for switching away from
//peers that stall so that you'll rotate through all the peers
//not just swich between two different peers.

function eachFrom(keys, key, iter) {
  var i = keys.indexOf(key)
  if(!~i) return
  //start at 1 because we want to visit all keys but key.
  for(var j = 1; j < keys.length; j++)
    if(iter(keys[(j+i)%keys.length], j))
      return
}

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

      //if we are already replicating, and this feed is at zero, ask for it anyway,
      //XXX if a feed is at zero, but we are replicating on another peer
      //just don't ask for it yet?
      var replicating = isAlreadyReplicating(state, id, ev.id) && state.clock[id]
      peer.notes[id] = !replicating ? state.clock[id] || 0 : ~(state.clock[id] || -1)
      peer.replicating = peer.replicating || {}
      var rep = peer.replicating[id] = {
        tx: false, rx: !replicating, sent: null
      }
    }
  }

  return state
}

//XXX handle replicating with only one peer.
exports.follow = function (state, ev) {
  //set to true once we have asked for this feed from someone.
  var replicating = false
  if(state.follows[ev.id] !== ev.value) {
    state.follows[ev.id] = ev.value
    for(var id in state.peers) {
      var peer = state.peers[id]
      if(!peer.clock) continue
      //cases:
      //  don't have feed
      //  do have feed
      //  peer has feed
      //  peer rejects feed
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
        var seq = state.clock[ev.id]
        peer.notes[ev.id] = replicating ? seq || 0 : ~(seq || -1)
        replicating = true
      }
    }
  }
  return state
}

exports.retrive = function (state, msg) {
  //check if any peer requires this msg
  for(var id in state.peers) {
    var peer = state.peers[id]
    var rep = peer.replicating[msg.author]
    if(rep && rep.tx && rep.sent === msg.sequence - 1) {
      rep.sent ++
      peer.msgs.push(msg)
      if(rep.sent < state.clock[msg.author]) {
        //use continue, not return because we still need to loop through other peers.
        if(~peer.retrive.indexOf(msg.author)) continue
        peer.retrive.push(msg.author)
      }
    }
  }
  return state
}

function isAhead(seq1, seq2) {
  if(seq2 === -1) return false
  if(seq2 == null) return true
  if(seq1 > seq2) return true
}

exports.append = function (state, msg) {
  //check if any peer requires this msg
  if(state.clock[msg.author] != null && state.clock[msg.author] !== msg.sequence - 1) return state //ignore

  state.clock[msg.author] = msg.sequence

  for(var id in state.peers) {
    var peer = state.peers[id]
    if(!peer.clock) continue

    var rep = peer.replicating[msg.author]

    if(rep && rep.tx && rep.sent == msg.sequence - 1 && msg.sequence > peer.clock[msg.author]) {
      peer.msgs.push(msg)
      rep.sent++
    }
    //if we are ahead of this peer, and not in tx mode, let them know that.
    else if(
      isAhead(msg.sequence, peer.clock[msg.author]) &&
      ( rep
        ? !rep.tx && rep.sent != null
        : state.follows[msg.author]
      )
    ) {
      peer.notes = peer.notes || {}
      peer.notes[msg.author] = ~msg.sequence
    }
  }

  return state
}

//XXX if we only receive from a single peer,
//then we shouldn't really get known messages?
//except during the race when we have disabled a peer
//but they havn't noticed yet.
exports.receive = function (state, ev) {
  var msg = ev.value
  //receive a message, validate and append.
  //if this message is forked, disable this feed

  if(!state.peers[ev.id]) throw new Error('lost peer state:'+ev.id)

  //we _know_ that this peer is upto at least this message now.
  //(but maybe they already told us they where ahead further)
  var peer = state.peers[ev.id]
  var rep = peer.replicating[msg.author]

  //if we havn't asked for this, ignore it. (this is remote speaking protocol wrong!)
  if(!rep) return state

  peer.clock[msg.author] = Math.max(peer.clock[msg.author], msg.sequence)
  rep.sent = Math.max(rep.sent, msg.sequence)

  //if this message has already been seen, ignore.
  if(state.clock[msg.author] > msg.sequence) {
    if (rep.rx) {
      peer.notes = peer.notes || {}
      peer.notes[msg.author] = ~state.clock[msg.author]
      rep.rx = false
      //XXX activate some other peer?
    }
    return state
  }

  //remember the time of the last message received
  state.peers[ev.id].ts = ev.ts
  state.receive.push(msg)
  //Q: possibly update the receiving mode?

  return state
}


//XXX check if we are already receiving a feed
//and if so put this into lazy mode.
exports.notes = function (state, ev) {
  //update replicating modes
  var clock = ev.value
  var peer = state.peers[ev.id]
  if(!peer) throw new Error('lost state of peer:'+ev.id)
  if(!peer.clock) throw new Error("received notes, but has not set the peer's clock yet")
  var count = 0
  for(var id in clock) {
    count ++
    var seq = clock[id]
    seq = Number.isInteger(seq) ? seq : -1
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
      var replicating = isAlreadyReplicating(state, id, ev.id)
      if(!rep) {
        rep = peer.replicating[id] = {
          tx: true, //true,
          rx: true, //!replicating, //lseq < _seq,
          sent: _seq
        }
        peer.notes = peer.notes || {}
        peer.notes[id] = lseq == 0 ? 0 : lseq < _seq && !replicating ? lseq : ~lseq
        rep.rx = peer.notes[id] >= 0
      }
      else if(!rep.rx && _seq > lseq) {
        if(!replicating) {
          rep.rx = true
          peer.notes = peer.notes || {}
          peer.notes[id] = lseq
          peer.ts = ev.ts //remember ts, so we can switch this feed if necessary
        } else {
          //if we are already replicating this via another peer
          //switch to this peer if it is further ahead.
          //(todo?: switch if the other peer's timestamp is old?)
          var _peer = state.peers[replicating]
          if(_seq > _peer.clock[id]) {
            rep.rx = true
            peer.notes = peer.notes || {}
            peer.notes[id] = lseq
            peer.ts = ev.ts
            //deactivate the previous peer
            _peer.notes = _peer.notes || {}
            _peer.notes[id] = ~lseq
            _peer.replicating[id].rx = false
          }
        }
      }
      //positive seq means "send this to me please"
      rep.tx = seq >= 0
      //in the case we are already ahead, get ready to send them messages.
      rep.sent = _seq
      if(seq >= 0 && state.clock[id] > _seq) {
        peer.retrive.push(id)
      }
      else if(state.clock[id] > _seq && !rep.tx && seq != -1) {
        peer.notes = peer.notes || {}
        peer.notes[id] = rep.rx ? ~lseq : lseq
      }
    }
  }
  peer.recvNotes = (peer.recvNotes || 0) + count
  return state
}

exports.timeout = function (state, ev) {
  var want = {}
  for(var peer_id in state.peers) {
    var peer = state.peers[peer_id]
    //check if the peer hasn't received a message recently.

    //if we havn't received a message from this peer recently
    if((peer.ts || 0) + state.timeout < ev.ts) {
      //check if they have claimed a higher sequence, but not sent us
      for(var id in peer.replicating) {

        var rep = peer.replicating[id]
        //if yes, prepare to switch this feed to that peer
        if(rep.rx && isAvailable(state, id, peer_id)) {
          want[id] = peer_id
          peer.notes = peer.notes || {}
          peer.notes[id] = ~state.clock[id]
          rep.rx = false
        }
      }
    }
  }
  var peer_ids = Object.keys(state.peers)
  for(var feed_id in want) {
    var ignore_id = want[feed_id]
    eachFrom(peer_ids, ignore_id, function (peer_id) {
      var peer = state.peers[peer_id]
      if(peer.clock[feed_id] || 0 > state.clock[feed_id] || 0) {
        peer.notes = peer.notes || {}
        peer.notes[feed_id] = state.clock[feed_id] || 0
        peer.replicating = peer.replicating || {}
        peer.ts = ev.ts
        var rep = peer.replicating[feed_id] = peer.replicating[feed_id] || {
          tx: false, rx: true, sent: -1
        }
        //returning true triggers the end of eachFrom
        return rep.rx = true
      }
    })
  }
  return state
}

