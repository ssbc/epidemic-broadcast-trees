var Stream = require('./stream')
var events = require('./events')
var progress = require('./progress')

function timestamp () {
  return Date.now()
}

module.exports = function (opts) {
  var state = events.initialize(opts.id, timestamp())
  state.clock = {}
  var self = {
    id: opts.id,
    streams: {},
    state: state,
    logging: opts.logging,
    progress: function () {
      return progress(state)
    },
    request: function (id, follows) {
      self.state = events.follow(self.state, {id: id, value: follows !== false, ts: timestamp()})
      self.update()
    },
    createStream: function (remote_id) {
      if(this.streams[remote_id])
        this.streams[remote_id].end(new Error('reconnected to peer'))
      if(this.logging) console.error('EBT:conn', remote_id)
      var stream = this.streams[remote_id] = new Stream(this, remote_id, function (peerState) {
        opts.setClock(remote_id, peerState.clock)
      })
      opts.getClock(remote_id, function (err, clock) {
        //check if peer exists in state, because we may
        //have disconect in the meantime
        if(self.state.peers[remote_id])
          stream.clock(err ? {} : clock)
      })
      return stream
    },
    _retrive: function (err, msg) {
      if(msg) {
        self.state = events.retrive(self.state, msg)
        self.update()
      }
      else {
        //this should never happen.
        //replication for this feed is in bad state now.
        console.log('could not retrive msg:', err)
      }
    },
    onAppend: function (msg) {
      self.state = events.append(self.state, msg)
      self.update()
    },
    _append: function (err, msg) {
      if(msg) {
        self.onAppend(msg)
      }
      else
        //this definitely can happen.
        //TODO: broadcast fork proofs
        console.log('error appending:', err)
    },
    update: function () {
      //retrive next messages.
      //TODO: respond to back pressure from streams to each peer.
      //if a given stream is paused, don't retrive more msgs
      //for that peer/stream.
      for(var id in this.state.peers) {
        var state = this.state.peers[id]
        while(state.retrive.length) {
          var id = state.retrive.shift()
          if(state.replicating[id])
            opts.getAt({id: id, sequence:state.replicating[id].sent+1}, this._retrive)
        }
      }
      if(this.state.receive.length) {
        var msg = this.state.receive.shift()
        opts.append(msg, this._append)
      }
      for(var k in this.streams)
        this.streams[k].resume()
    },
  }
  return self
}

