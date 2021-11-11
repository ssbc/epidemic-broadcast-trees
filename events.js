'use strict'

module.exports = function (version) {

  const { note, getReceive, getReplicate, getSequence } = version

  var exports = {
    note,
    getReceive,
    getReplicate,
    getSequence
  }

  function isEmpty (o) {
    for (var k in o) return false
    return true
  }

  function isObject (o) {
    return o && 'object' === typeof o
  }

  function isBlocked(state, id, target) {
    return state.blocks[id] && state.blocks[id][target]
  }

  function isShared (state, id, peerId) {
    return state.follows[id] && !isBlocked(state, id, peerId)
  }

  //check if a feed is already being replicated on another peer from ignoreId
  function isAlreadyReplicating(state, feedId, ignoreId) {
    for (var id in state.peers) {
      if (id !== ignoreId) {
        var peer = state.peers[id]
        if (peer.notes && getReceive(peer.notes[id])) return id

        // for replicating the node must have replicated something not just rx
        // this fixed a partial replication bug where a node is unable to send the full log
        var idHasSent = peer.replicating && peer.replicating[id] && peer.replicating[id].sent != -1
        if (peer.replicating && peer.replicating[feedId] && peer.replicating[feedId].rx && idHasSent) return id
      }
    }
    return false
  }

  // lower numbers should be respected
  // if one is -1 and the other is not, use the other
  function fixSeq (local, remote) {
    if (local == null) return remote
    if (local == -1 || remote == -1) return remote
    if (remote == 0) return 0
    if (remote > 0 && local > 0 && remote < local) return remote
    return Math.max(local, remote)
  }

  //check if a feed is available from a peer apart from ignoreId

  function isAvailable(state, feedId, ignoreId) {
    for (var peerId in state.peers) {
      if (peerId != ignoreId) {
        var peer = state.peers[peerId]
        //BLOCK: check wether id has blocked this peer
        if ((peer.clock && peer.clock[feedId] || 0) > (state.clock[feedId] || 0) && isShared(state, feedId, peerId)) {
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
    if (!~i) return
    //start at 1 because we want to visit all keys but key.
    for (var j = 1; j < keys.length; j++)
      if (iter(keys[(j+i) % keys.length], j))
        return
  }

  function setNotes (peer, feed, seq, rx) {
    peer.notes = peer.notes || {}
    peer.notes[feed] = note(seq, rx)

    var rep = peer.replicating[feed]
    if (rep) {
      rep.rx = rx
      rep.requested = seq
    }
  }

  // defaults for backwards compatibility
  exports.getMsgAuthor = function(msg) {
    return msg.author
  }
  exports.getMsgSequence = function(msg) {
    return msg.sequence
  }

  exports.initialize = function (id, getMsgAuthor, getMsgSequence) {
    if (getMsgAuthor)
      exports.getMsgAuthor = getMsgAuthor
    if (getMsgSequence)
      exports.getMsgSequence = getMsgSequence

    return {
      id: id,
      clock: null,
      follows: {},
      blocks: {},
      peers: {},
      receive: []
    }
  }

  exports.clock = function (state, clock) {
    state.clock = clock
    return state
  }

  exports.connect = function (state, ev) {
    if (state.peers[ev.id]) throw new Error('already connected to peer:'+ev.id)
    if (typeof ev.client != 'boolean') throw new Error('connect.client must be boolean')

    //  if (isBlocked(state, state.id, ev.id)) return state

    state.peers[ev.id] = {
      blocked: isBlocked(state, state.id, ev.id),
      clock: null,
      client: !!ev.client,
      msgs: [],
      retrive: [],
      notes: null,
      //if we are client, wait until we receive notes to send code.
      //this is a weird way of doing it! shouldn't we just have a bit of state
      //for wether we have received a vector clock
      replicating: ev.client ? null : {}
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
    if (!state.peers[ev.id])
      throw new Error('peerClock called for:'+ev.id + ' but only connected to:'+ Object.keys(state.peers))
    var peer = state.peers[ev.id]
    var clock = peer.clock = ev.value

    //client should wait for the server notes, so that stream
    //can error before a peer sends a massive handshake.
    if (peer.replicating == null) return state

    //always set an empty clock here, so that if we don't have anything
    //to send, we still send this empty clock. This only happens on a new connection.
    //in every other situation, clock is only sent if there is something in it.
    peer.notes = peer.notes || {}

    //iterate over following and create replications.
    //if we want to replicate a peer that has changed since their clock,
    //create a replication for that peer.

    for (var id in state.follows) {
      var seq = clock[id] || 0, lseq = state.clock[id] || 0
      //BLOCK: check wether id has blocked this peer
      if (isShared(state, id, ev.id) && seq !== -1 && seq !== state.clock[id]) {

        //if we are already replicating, and this feed is at zero, ask for it anyway,
        //XXX if a feed is at zero, but we are replicating on another peer
        //just don't ask for it yet?
        var replicating = isAlreadyReplicating(state, id, ev.id)// && lseq
        peer.replicating = peer.replicating || {}
        peer.replicating[id] = {
          tx: false,
          rx: !replicating,
          sent: null,
          requested: lseq
        }
        setNotes(peer, id, lseq, !replicating)
      }
    }

    return state
  }

  //XXX handle replicating with only one peer.
  exports.follow = function (state, ev) {
    //set to true once we have asked for this feed from someone.
    var replicating = false
    if (!!state.follows[ev.id] !== ev.value) {
      state.follows[ev.id] = ev.value
      for (var id in state.peers) {
        var peer = state.peers[id]
        if (!peer.clock || !peer.replicating || !isShared(state, ev.id, id)) continue
        //BLOCK: check wether this feed has has blocked this peer.
        //..... don't replicate feeds with peers that have blocked them at all?

        //cases:
        //  don't have feed
        //  do have feed
        //  peer has feed
        //  peer rejects feed
        var seq = peer.clock[ev.id] || 0, lseq = state.clock[ev.id] || 0
        if (seq === -1) {
          //peer explicitly does not replicate this feed, don't ask for it.
        }
        else if (ev.value === false) { //unfollow
          setNotes(peer, ev.id, -1, false)
        }
        else if (ev.value === true && seq !== state.clock[ev.id]) {
          peer.replicating[ev.id] = {
            rx: true, tx: false,
            sent: -1, requested: lseq
          }
          setNotes(peer, ev.id, lseq, !replicating)
          replicating = true
        }
      }
    }
    return state
  }

  exports.retrive = function (state, msg) {
    //check if any peer requires this msg
    for (var id in state.peers) {
      var peer = state.peers[id]
      if (!peer.replicating) continue
      //BLOCK: check wether id has blocked this peer
      const author = exports.getMsgAuthor(msg)
      const sequence = exports.getMsgSequence(msg)
      var rep = peer.replicating[author]

      if (rep && rep.tx && rep.sent === sequence - 1) {
        rep.sent++
        peer.msgs.push(msg)
        if (rep.sent < state.clock[author]) {
          //use continue, not return because we still need to loop through other peers.
          if (~peer.retrive.indexOf(author)) continue
          peer.retrive.push(author)
        }
      }
    }
    return state
  }

  function isAhead(seq1, seq2) {
    if (seq2 === -1) return false
    if (seq2 == null) return true
    if (seq1 > seq2) return true
  }

  exports.append = function (state, msg) {
    const author = exports.getMsgAuthor(msg)
    const sequence = exports.getMsgSequence(msg)
    //check if any peer requires this msg
    if (state.clock[author] != null && state.clock[author] !== sequence - 1)
      return state //ignore

    var lseq = state.clock[author] = sequence
    for (var id in state.peers) {
      var peer = state.peers[id]
      if (!peer.clock || !peer.replicating || !isShared(state, author, id)) continue
      //BLOCK: check wether msg.author has blocked this peer

      var seq = peer.clock[author]

      var rep = peer.replicating[author]

      if (rep && rep.tx && rep.sent == lseq - 1 && lseq > seq) {
        peer.msgs.push(msg)
        rep.sent++
      }
      //if we are ahead of this peer, and not in tx mode, let them know that.
      else if (
        isAhead(lseq, seq) &&
          (rep ? !rep.tx && rep.sent != null : state.follows[author])
      )
        setNotes(peer, author, sequence, false)
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

    if (!state.peers[ev.id]) throw new Error('lost peer state:'+ev.id)

    //we _know_ that this peer is upto at least this message now.
    //(but maybe they already told us they where ahead further)
    const author = exports.getMsgAuthor(msg)
    const sequence = exports.getMsgSequence(msg)
    var peer = state.peers[ev.id]
    var rep = peer.replicating[author]

    //if we havn't asked for this, ignore it. (this is remote speaking protocol wrong!)
    if (!rep) return state

    peer.clock[author] = Math.max(peer.clock[author], sequence)
    rep.sent = Math.max(rep.sent, sequence)

    //if this message has already been seen, ignore.
    if (state.clock[author] >= sequence) {
      if (rep.rx) {
        setNotes(peer, author, state.clock[author], false)
      }
      //XXX activate some other peer?
      return state
    }

    //remember the time of the last message received
    state.peers[ev.id].ts = ev.ts

    //FORKS ignore additional messages if we have already found an invalid one.
    if (isShared(state, exports.getMsgAuthor(ev.value), ev.id))
      state.receive.push(ev)
    //Q: possibly update the receiving mode?

    return state
  }

  //XXX check if we are already receiving a feed
  //and if so put this into lazy mode.
  exports.notes = function (state, ev) {
    //update replicating modes
    var clock = ev.value

    //support sending clocks inside a thing with additional properties.
    //this is to allow room for backwards compatible upgrades.
    if (isObject(ev.value.clock))
      clock = ev.value.clock

    var peer = state.peers[ev.id]
    if (!peer) throw new Error('lost state of peer:'+ev.id)
    if (!peer.clock) throw new Error("received notes, but has not set the peer's clock yet")
    var count = 0

    //if we are client, and this is the first notes we receive
    if (!peer.replicating) {
      peer.replicating = {}
      state = exports.peerClock(state, {id: ev.id, value: state.peers[ev.id].clock})
    }

    for (var id in clock) {
      count++

      var seq = peer.clock[id] = fixSeq(peer.clock[id], getSequence(clock[id]))
      var tx = getReceive(clock[id]) // is even
      var isReplicate = getReplicate(clock[id]) // !== -1

      var lseq = state.clock[id] || 0

      //check if we are not following this feed.
      //BLOCK: or wether id has blocked this peer
      if (!isShared(state, id, ev.id)) {
        if (!peer.replicating[id])
          setNotes(peer, id, -1)
        peer.replicating[id] = {tx: false, rx: false, sent: -1, requested: -1}
      }
      else {
        var rep = peer.replicating[id]
        var replicating = isAlreadyReplicating(state, id, ev.id)
        if (!rep) {
          rep = peer.replicating[id] = {
            tx: true,
            rx: true,
            sent: seq,
            requested: lseq
          }
          setNotes(peer, id, lseq, lseq < seq && !replicating)
        }
        else if (!rep.rx && seq > lseq) {
          if (!replicating) {
            peer.ts = ev.ts //remember ts, so we can switch this feed if necessary
            setNotes(peer, id, lseq, true)
          } else {
            //if we are already replicating this via another peer
            //switch to this peer if it is further ahead.
            //(todo?: switch if the other peer's timestamp is old?)
            var _peer = state.peers[replicating]
            // note: _peer.clock[id] may be undefined, if we have
            // just connected to them and sent our notes but not
            // received theirs.
            if (seq > (_peer.clock[id] || 0)) {
              peer.ts = ev.ts
              setNotes(peer, id, lseq, true)
              setNotes(_peer, id, lseq, false) //deactivate the previous peer
            }
          }
        }

        //positive seq means "send this to me please"
        rep.tx = tx
        //in the case we are already ahead, get ready to send them messages.
        rep.sent = seq
        if (lseq > seq) {
          if (tx) peer.retrive.push(id)
          else if (isReplicate) setNotes(peer, id, lseq, rep.rx)
        }
      }
    }

    peer.recvNotes = (peer.recvNotes || 0) + count
    return state
  }

  exports.timeout = function (state, ev) {
    var want = {}

    for (var peerId in state.peers) {
      var peer = state.peers[peerId]
      //check if the peer hasn't received a message recently.

      //if we havn't received a message from this peer recently
      if ((peer.ts || 0) + state.timeout < ev.ts) {
        //check if they have claimed a higher sequence, but not sent us
        for (var id in peer.replicating) {

          var rep = peer.replicating[id]
          //if yes, prepare to switch this feed to that peer
          if (rep.rx && isAvailable(state, id, peerId)) {
            want[id] = peerId
            setNotes(peer, id, state.clock[id], false)
          }
        }
      }
    }

    var peerIds = Object.keys(state.peers)
    for (var feedId in want) {
      var ignoreId = want[feedId]
      eachFrom(peerIds, ignoreId, function (peerId) {
        var peer = state.peers[peerId]
        if (peer.clock && peer.clock[feedId] || 0 > state.clock[feedId] || 0) {
          peer.replicating = peer.replicating || {}
          peer.replicating[feedId] = peer.replicating[feedId] || {
            tx: false, rx: true, sent: -1, requested: state.clock[feedId]
          }
          setNotes(peer, feedId, state.clock[feedId], true)
          peer.ts = ev.ts
          //returning true triggers the end of eachFrom
          return true
        }
      })
    }

    return state
  }

  exports.block = function (state, ev) {
    if (!ev.value) {
      if (state.blocks[ev.id]) delete state.blocks[ev.id][ev.target]
      if (isEmpty(state.blocks[ev.id]))
        delete state.blocks[ev.id]
    }
    else {
      state.blocks[ev.id] = state.blocks[ev.id] || {}
      state.blocks[ev.id][ev.target] = true
    }

    //if we blocked this peer, and we are also connected to them.
    //then stop replicating immediately.
    if (state.id === ev.id && state.peers[ev.target]) {
      //end replication immediately.
      state.peers[ev.target].blocked = ev.value
    }

    for (var id in state.peers) {
      var peer = state.peers[id]
      if (!peer.replicating) continue
      if (id === ev.target && peer.replicating[ev.id])
        setNotes(peer, ev.id, -1, false)
    }

    return state
  }

  return exports
}

/*
  what does a fork proof look like?

  usually, you have one message, and receive a subsequent message.
  (n, n'+1), except that n'+1 does not extend n. but both have valid
  signatures.

*/
