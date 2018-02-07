var Stream = require('./stream')
var events = require('./events')

module.exports = function (opts) {
  var state = events.initialize(opts.id)
  state.clock = {}
  var self = {
    id: opts.id,
    streams: {},
    state: state,
    request: function (id, follows) {
      self.state = events.follow(self.state, {id: id, value: follows})
      self.update()
    },
    createStream: function (remote_id) {
      var stream = this.streams[remote_id] = new Stream(this, remote_id)
      opts.getClock(remote_id, function (err, clock) {
        stream.clock(err ? {} : clock)
      })
      return stream
    },
    _retrive: function (err, msg) {
      if(msg) {
        self.state = events.retrive(self.state, msg)
        this.update()
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
      for(var id in this.state.peers) {
        var state = this.state.peers[id]
        while(state.retrive.length) {
          var id = state.retrive.shift()
          if(state.replicating[id])
            opts.getAt({id: id, seq:state.replicating[id].sent+1}, this._retrive)
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


