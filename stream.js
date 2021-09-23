const v3 = require('./v3')

module.exports = function (events) {
  function timestamp () {
    return Date.now()
  }

  function EBTStream (peer, remote, version, client, isMsg, onClose) {
    this.paused = true //start out paused
    this.remote = remote
    this.peer = peer
    this.version = version
    this.peer.state = events.connect(this.peer.state, {
      id: remote,
      ts: timestamp(),
      client: client
    })
    this.ended = false
    this._onClose = onClose
    this.isMsg = isMsg
    this.sink = this.source = null
  }

  EBTStream.prototype.clock = function (clock) {
    this.peer.state = events.peerClock(this.peer.state, {
      id: this.remote,
      value: clock,
      ts: timestamp()
    })
    this.paused = false
    this.peer.update()
    if(this.source) this.source.resume()
  }

  EBTStream.prototype.write = function (data) {
    if(this.peer.logging) {
      if (Buffer.isBuffer(data))
        console.log("EBT:recv binary (" + this.peer.id + ")", "0x" + data.toString('hex'))
      else
        console.log("EBT:recv json (" + this.peer.id + ")", JSON.stringify(data, null, 2))
    }
    if(this.ended) throw new Error('write after ebt stream ended:'+this.remote)
    if(this.isMsg(data)) {
      this.peer.state = events.receive(this.peer.state, {
        id: this.remote,
        value: data,
        ts: timestamp()
      })
    } else {
      this.peer.state = events.notes(this.peer.state, {
        id: this.remote,
        value: data,
        ts: timestamp()
      })
    }

    this.peer.update(this.remote)
  }

  EBTStream.prototype.abort = EBTStream.prototype.end = function (err) {
    this.ended = true
    //check if we have already ended
    if(!this.peer.state.peers[this.remote]) return

    if(this.peer.logging) console.log('EBT:dcon', this.remote)

    var peerState = this.peer.state.peers[this.remote]
    this.peer.state = events.disconnect(this.peer.state, {
      id: this.remote,
      ts: timestamp()
    })
    if(this._onClose) this._onClose(peerState)
    //remove from the peer...
    delete this.peer.streams[this.remote]
    if(this.source && !this.source.ended) this.source.abort(err)
    if(this.sink && !this.sink.ended) this.sink.end(err)
  }

  EBTStream.prototype.canSend = function () {
    var state = this.peer.state.peers[this.remote]
    return (
      this.sink &&
        !this.sink.paused &&
        !this.ended && (
          //missing state means this peer was blocked,
          //end immediately.
          state.blocked || state.msgs.length || state.notes
        )
    )
  }

  EBTStream.prototype.resume = function () {
    var state = this.peer.state.peers[this.remote]
    if(!this.sink || this.sink.paused) return
    while(this.canSend()) {
      if(state.blocked)
        this.end()
      else if(state.msgs.length) {
        if(this.peer.logging) {
          if (Buffer.isBuffer(state.msgs[0]))
            console.log("EBT:send binary (" + this.peer.id + ")", "0x" + state.msgs[0].toString('hex'))
          else
            console.log("EBT:send json (" + this.peer.id + ")", JSON.stringify(state.msgs[0], null, 2))
        }
        this.sink.write(state.msgs.shift())
      }
      else {
        var notes = state.notes
        state.notes = null
        if(this.peer.logging) {
          const formattedNotes = {}
          for (let feed in notes) {
            const seq = notes[feed]
            formattedNotes[feed] = {
              seq,
              sequence: v3.getSequence(seq),
              rx: v3.getReceive(seq)
            }
          }
          console.log("EBT:send notes (" + this.peer.id + ")", formattedNotes)
        }
        this.sink.write(notes)
      }
    }
  }

  EBTStream.prototype.pipe = require('push-stream/pipe')

  return EBTStream
}
