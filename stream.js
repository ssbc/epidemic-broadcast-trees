var S = require('./state')
var u = require('./util')
var isNote = u.isNote
var isMessage = u.isMessage

function oldest(states) {
  var min, key
  for(var k in states) {
    if(isMessage(states[k].ready)) {
      if(min == null) {
        key = k
      }
      else if(min > states[k].ready.timestamp) {
        min = states[k].ready.timestamp
        key = k
      }
    }
  }
  return key
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
    else
      fn = _fn
  }
}

module.exports = function (states, get, append) {
  var next = Next()
  function checkNote (k) {
    if(isNote(states[k].effect)) {
      get(k, states[k].effect, function (err, msg) {
        if(msg) {
          states[k] = S.gotMessage(states[k], msg)
          if(states[k].ready) next()
        }
      })
    }
  }
  var stream
  return stream = {
    sink: function (read) {
      read(null, function cb (err, data) {
        if(isMessage(data)) {
          states[data.author] = S.receiveMessage(states[data.author], data)
          if(isMessage(states[data.author].effect)) {//append this message
            states[data.author].effect = null
            //append MUST call onAppend before the callback.
            append(data, function (err) {
              read(null, cb)
            })
          }
          else
            read(null, cb)

          next()
        }
        else {
          var ready = false

          for(var k in data) (function (k, seq) {
            states[k] = S.receiveNote(states[k], seq)
            if(states[k].ready != null)
              ready = true
            checkNote(k)
          })(k, data[k])

          if(ready) next()
          read(null, cb)
        }
      })
    },
    source: function (abort, cb) {
      //if there are any states with a message to send, take the oldest one.
      //else, collect all states with a note, and send as a bundle.
      ;(function read () {
        var key
        if(key = oldest(states)) {
          var msg = states[key].ready
          states[key] = S.read(states[key])
          checkNote(key)
          cb(null, msg)
        }
        else {
          var notes = {}, n = 0
          for(var k in states) {
            if(isNote(states[k].ready)) {
              n ++
              notes[k] = states[k].ready
              states[k] = S.read(states[k])
              checkNote(k)
            }
          }
          if(n) cb(null, notes)
          else next(read)
        }
      })()
    },
    onAppend: function (msg) {
      var k = msg.author
      if(states[k]) {
        states[k] = S.appendMessage(states[k], msg)
        checkNote(k)
        next()
      }
    }
  }
}

