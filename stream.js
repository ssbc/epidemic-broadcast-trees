var v2 = require('./v2')
var v3 = require('./v3')

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
    if(this.peer.logging) console.log("EBT:recv", JSON.stringify(data, null, 2))
    if(this.ended) throw new Error('write after ebt stream ended:'+this.remote)
    if(this.isMsg(data)) {
      this.peer.state = events.receive(this.peer.state, {
        id: this.remote,
        value: data,
        ts: timestamp()
      })
    } else {
      if(this.version === 2) {
        var _data = data; data = {}
        for(var k in _data) {
          data[k] = v3.note(v2.getSequence(_data[k]), v2.getReceive(_data[k]))
        }
      }

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
        if(this.peer.logging) console.log("EBT:send", JSON.stringify(state.msgs[0], null, 2))
        this.sink.write(state.msgs.shift())
      }
      else {
        var notes = state.notes
        state.notes = null

        if(this.version === 2) {
          var _notes = {}
          for(var k in notes) {
            _notes[k] = v2.note(v3.getSequence(notes[k]), v3.getReceive(notes[k]))
          }
          notes = _notes
        }

        if(this.peer.logging) console.log("EBT:send (" + this.peer.id + ")", notes)
        this.sink.write(notes)
      }
    }
  }

  EBTStream.prototype.pipe = require('push-stream/pipe')

  return EBTStream
}
