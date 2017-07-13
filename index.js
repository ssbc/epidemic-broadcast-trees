'use strict'
var S = require('./state')
var u = require('./util')
var isNote = u.isNote
var isMessage = u.isMessage
var progress = require('./progress')

function oldest(ready, states) {
  //could do ready.sort but that is O(n*log(n)) (i think?) so faster to iterate

  var min = null
  for(var i = ready.length - 1; i >= 0; i--) {
    if(!isMessage(ready[i].ready))
      ready.splice(i, 1) //this item is not a ready message (any more) remove from queue)
    else if(min == null)
      min = i
    else if (ready[i].ready.timestamp < ready[i].ready.timestamp) min = i
  }

  if(min != null) {
    var state = ready[min]
    ready.splice(i, 1)
    return state
  }

}

function Next () {
  var fn
  return function next (_fn) {
    if(fn) {
      if(_fn) throw new Error('already waiting! '+fn.toString())
      else {
        _fn = fn; fn = null; _fn()
      }
    }
    else {
      fn = _fn
    }
  }
}

function toEnd(err) {
  return err === true ? null : err
}

//get, append are tied to the protocol
//seqs, onChange, onRequest, callback are tied to the instance.
module.exports = function (get, append) {

  return function (opts, callback) {
    if('function' === typeof opts)
      callback = opts, opts = {}

    var readyMsg = [], readyNote = {}
    var onChange = opts.onChange || require('./bounce')(function () {
      console.log(progress(states))
    }, 1000)

    //called if this feed is has not been requested
    var onRequest = opts.onRequest || function (id, seq) {
      stream.request(id, 0)
    }

    function maybeQueue(key, state) {
      if('string' !== typeof key) throw new Error('key should be string')
      if('object' !== typeof state)
        throw new Error('state should be object')

      if(isMessage(state.ready))
        readyMsg.push(state)
      else if(isNote(state.ready))
        readyNote[key] = true
    }

    var states = {}, error
    var meta = {
      recv: {message:0, note: 0},
      send: {message:0, note: 0}
    }

    var next = Next()
    function checkNote (k) {
      if(isNote(states[k].effect)) {
        get(k, states[k].effect, function (err, msg) {
          if(msg) {
            maybeQueue(k, states[k] = S.gotMessage(states[k], msg))
            if(states[k].ready) next()
          }
        })
      }
    }

    var stream = {
      sink: function (read) {
        read(null, function cb (err, data) {
          //handle errors and aborts
          if(err && !error) { //if this sink got an error before source was aborted.
            callback(toEnd(error = err))
          }
          if(error) return read(error, function () {})

          if(isMessage(data)) {
            meta.recv.message ++
            maybeQueue(data.author, states[data.author] = S.receiveMessage(states[data.author], data))
            if(isMessage(states[data.author].effect)) {//append this message
              states[data.author].effect = null
              // *** append MUST call onAppend before the callback ***
              //for performance, append should verify + queue the append, but not write to database.
              //also note, there may be other messages which have been received
              //and we could theirfore do parallel calls to append, but would make this
              //code quite complex.
              append(data, function (err) {
                onChange()
                read(null, cb)
                next()
              })
            }
            else
              read(null, cb)

            next()
          }
          else {
            var ready = false

            for(var k in data) {
              //if we havn't requested this yet, see if we want it.
              //if we _don't want it_ we should say, otherwise
              //they'll ask us again next time.
              meta.recv.note ++
              if(!states[k]) {
                states[k] = S.init(null)
                onRequest(k, data[k])
              }
              maybeQueue(k, states[k] = S.receiveNote(states[k], data[k]))
              if(states[k].ready != null)
                ready = true
              checkNote(k)
            }

            if(ready) next()
            onChange()
            read(null, cb)
          }
        })
      },
      source: function (abort, cb) {
        //if there are any states with a message to send, take the oldest one.
        //else, collect all states with a note, and send as a bundle.
        //handle errors and aborts
        if(abort) {
          if(!error) //if the source was aborted before the sink got an error
            return callback(toEnd(error = abort))
          else
            error = abort
        }
        ;(function read () {
          //this happens when the client 
          if(error) return cb(error)

          var state
          if(readyMsg.length && (state = oldest(readyMsg)) && isMessage(state.ready)) {
            var msg = state.ready
            meta.send.message ++
            maybeQueue(msg.author, state = S.read(state))
            checkNote(msg.author)
            onChange()
            cb(null, msg)
          }
          else {
            var notes = {}, n = 0

            for(k in readyNote) {
              if(isNote(states[k].ready)) {
                n ++
                notes[k] = states[k].ready
                meta.send.note ++
                states[k] = S.read(states[k])
                checkNote(k)
              }
            }

            readyNote = {}

            onChange()
            if(n) cb(null, notes)
            else next(read)
          }
        })()
      },
      progress: function () {
        return progress(states)
      },
      onAppend: function (msg) {
        var k = msg.author
        //TMP, call a user provided function to decide how to handle this.
//        if(!states[k]) {
//          console.log('ON_APPEND', msg.author, msg.sequence)
//          maybeQueue(k, states[k] = S.init(msg.sequence))
//        }
//
        if(states[k]) {
          maybeQueue(k, states[k] = S.appendMessage(states[k], msg))
          checkNote(k)
          next()
        }
      },
      //but what if you want to push in a bunch
      //of items but not trigger next just yet?
      request: function (id, seq, isSingle) {
        //only allow updates if it's gonna change the state.
        //this section should move into state.js
        if(!Number.isInteger(seq))
          throw new Error('ebt.stream.request(seq): seq must be integer') 
        if(!states[id]) {
          states[id] = S.init(seq)
          readyNote[id] = true
        }
        else if(
          states[id].local.seq == null ||
          states[id].local.seq == -1 ||
          (seq === -1 && states[id].local.seq != -1)
        ) {
          //MUST set the local state, otherwise receiveMessage won't work.
          if(seq >= 0) states[id].local.seq = seq
          states[id].ready = seq
          readyNote[id] = true
          if(isSingle !== false) {
            next()
          }
        }
      },
      states: states,
      meta: meta,
      next: next
    }

    if(opts.seqs) {
      for(var k in opts.seqs)
        stream.request(k, opts.seqs[k])
    }
    return stream

  }
}



