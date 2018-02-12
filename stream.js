var inherits = require('inherits')
var events = require('./events')

function isMsg (m) {
  return Number.isInteger(m.sequence) && m.sequence > 0 && 'string' == typeof m.author && m.content
}

module.exports = EBTStream

function EBTStream (peer, remote, onClose) {
  this.paused = true //start out paused
  this.remote = remote
  this.peer = peer
  this.peer.state =
    events.connect(this.peer.state, {id: remote})

  this._onClose = onClose

  this.sink = this.source = null
}

EBTStream.prototype.clock = function (clock) {
  this.peer.state =
    events.peerClock(this.peer.state, {id: this.remote, value: clock})
  this.paused = false
  this.peer.update()
  if(this.source) this.source.resume()
}

EBTStream.prototype.write = function (data) {
  if(isMsg(data))
    this.peer.state =
      events.receive(this.peer.state, {id: this.remote, value:data})
  else
    this.peer.state =
      events.notes(this.peer.state, {id: this.remote, value: data})

  this.peer.update(this.remote)
}

EBTStream.prototype.abort = EBTStream.prototype.end = function (err) {
  //check if we have already ended
  if(!this.peer.state.peers[this.remote]) return

  var peerState = this.peer.state.peers[this.remote]
  this.peer.state =
    events.disconnect(this.peer.state, {id: this.remote})
  if(this._onClose) this._onClose(peerState)
  //remove from the peer...
  delete this.peer.streams[this.remote]
  if(this.sink && !this.sink.ended) this.sink.end(err)
}

EBTStream.prototype.canSend = function () {
  var state = this.peer.state.peers[this.remote]
  return (
    this.sink &&
    !this.sink.paused && (
      state.msgs.length || state.notes
    )
  )
}

EBTStream.prototype.resume = function () {
  var state = this.peer.state.peers[this.remote]
  if(!this.sink || this.sink.paused) return
  while(this.canSend()) {
    if(state.msgs.length) {
      this.sink.write(state.msgs.shift())
    }
    else {
      var notes = state.notes
      state.notes = null
      this.sink.write(notes)
    }
  }
}

EBTStream.prototype.pipe = require('push-stream/pipe')

