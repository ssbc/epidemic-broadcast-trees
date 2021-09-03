var events = require('./events')(require('./v3'))
var Stream = require('./stream')(events)
var progress = require('./progress')

function timestamp () {
  return Date.now()
}

// Returns a function that removes keys from `clock` where `!isFeed(key)`.
function createValidate (isFeed) {
  return function (clock) {
    for(var outerKey in clock) {
      if(!isFeed(outerKey)) {
        var _clock = {}
        for(var innerKey in clock) {
          if(isFeed(innerKey)) _clock[innerKey] = clock[innerKey]
        }
        return _clock
      }
    }
    return clock
  }
}

module.exports = function (opts) {
  var state = events.initialize(opts.id, opts.getMsgAuthor, opts.getMsgSequence)
  state.timeout = opts.timeout || 3000
  state.clock = {}

  if (!opts.isMsg) {
    opts.isMsg = function(m) {
      return Number.isInteger(m.sequence) && m.sequence > 0 &&
        typeof m.author == 'string' && m.content
    }
  }

  var self = {
    id: opts.id,
    streams: {},
    state: state,
    logging: opts.logging,
    progress: function () {
      return progress(state)
    },
    request: function (id, follows) {
      if(opts.isFeed && !opts.isFeed(id)) return
      self.state = events.follow(self.state, {id: id, value: follows !== false, ts: timestamp()})
      self.update()
    },
    pause: function (id, paused) {
      self.state = events.pause(self.state, {id: id, paused: paused !== false})
      self.update()
    },
    block: function (id, target, value) {
      self.state = events.block(self.state, {id: id, target: target, value: value !== false, ts: timestamp()})
      self.update()
    },
    createStream: function (remoteId, version, format, client) {
      if (version === 3) {
        client = format
        format = 'classic'
      }

      const streamsId = remoteId+format

      if (this.streams[streamsId])
        this.streams[remoteId].end(new Error('reconnected to peer'))
      if (this.logging) console.log('EBT:conn', remoteId)

      let stream = new Stream(this, remoteId, version, client, opts.isMsg, function (peerState) {
        opts.setClock(remoteId, peerState.clock)
      })
      this.streams[streamsId] = stream

      if (opts.isFeed)
        stream._validate = createValidate(opts.isFeed)

      opts.getClock(remoteId, function (err, clock) {
        //check if peer exists in state, because we may
        //have disconect in the meantime
        if(self.state.peers[remoteId])
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
    update: function () {
      //retrive next messages.
      //TODO: respond to back pressure from streams to each peer.
      //if a given stream is paused, don't retrive more msgs
      //for that peer/stream.
      for(var peer in this.state.peers) {
        var state = this.state.peers[peer]
        while(state.retrive.length) {
          var id = state.retrive.shift()
          if(state.replicating[id])
            opts.getAt({
              id: id,
              sequence:state.replicating[id].sent+1
            }, this._retrive)
        }
      }
      if(this.state.receive.length) {
        var ev = this.state.receive.shift()
        opts.append(ev.value, function (err) {
          if(err) {
            if(this.logging) console.error('EBT:err', err)
            self.block(ev.value.author, ev.id, true)
          }
          else self.onAppend(ev.value)
        })
      }
      for(var k in this.streams)
        this.streams[k].resume()
    },
  }

  var int = setInterval(function () {
    self.state = events.timeout(self.state, {ts: timestamp()})
    self.update()
  }, state.timeout)
  if(int.unref) int.unref()

  return self
}
