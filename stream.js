'use strict'
var state = require('./state')
var explain = require('explain-error')
var u = require('./util')

var isMessage = u.isMessage
var isNote = u.isNote

//local and remote are observables, containing maps {id:sequence}
//if sequence is negative on remote then it means "up to here" but do not send.

exports = module.exports = function (local, get, append, cb) {

  var remotes = {}
  var queues = [] //the remotes, but sorted by who has the next message to send.

  var actions = {
    append: append,
    get: function (note) {
      get(note, function (err, msg) {
        //this error should never happen
        if(err) return console.error(explain(error, 'could not get message:'+JSON.stringify(note)))
        if(remotes[msg.author])
          remotes[msg.author] = effects(state.retrivedMessage(remotes[msg.author], msg))
      })
    }
  }

  function read (abort, cb) {
    //find the most recent queue and send it.
    ;(function next () {
      u.sort(queue)

      if(!queue.length) //nothing ready.
        return ready.once(next, false)
      else if(isMessage(queue[0])) {
        var msg = queue[0].ready
        queue[0].ready = null
        queue[0].state.effect = [{action: 'get', arg: {id: msg.author, seq: msg.sequence + 1}}]
        cb(null, msg)
      }
      else if(isNote(queue[0])) {
        //lump together all available notes into a single {<id>: <seq>,...} object
        var notes = {}
        for(var i = 0; isNote(queue[i].ready); i++) {
          notes[queue[i].ready.id] = queue[i].ready.seq
          queue[i].ready = null
        }
        //we don't need to queue an effect, because notes are always triggered by other events.
        cb(null, notes)
      }
      else
        ready.once(next, false)
    })()
  }

  function effects (state) {
    if(!state.effect || !state.effect.length) return
    var effects = state.effect
    state.effect = []
    while(effects.length) {
      var effect = effects.shift()
      actions[effect.action](effect.value)
    }
    if(state.ready) ready(state)
  }

  //a message was received or created, in real time

  return {
    source: read,
    sink: pull.drain(function (data) {
      if(isMessage(data) && remotes[data.author]) {
        var msg = data
        remotes[msg.author] = effects(state.receiveMessage(remotes[msg.author], msg))
      }
      else if(isNotes(data)) {
        //go through and update all state, then process all effects
        for(var id in data) {
          if(!remotes[id] && replicate(id))
            remotes[id] = state.initalize(local, data[id])
          if(remotes[id])
            remotes[id] = state.receiveNote(remotes[id], {id: id, seq: data[id]})
        }
        for(var id in data)
          remotes[id] = effects(remotes[id])
      }
    }, cb),
    //must call append when a message is added in real time (not for old messages though)
    //maybe pass in a stream instead?
    append: function (msg) {
      //it can be greater or equal,
      //because more than one message could have been processed before append is called.
      if(local[msg.author] < msg.sequence)
        throw new Error('local sequence is expected to be at greater or equal to '+msg.sequence)

      if(remotes[msg.author])
        remotes[msg.author] = effects(state.appendMessage(remotes[msg.author], msg))
    },
    //how to request the feeds to replicate?
    //1. observable
    //2. expose a function?

    //what do I call it with? {<id>: received?} and received should be able to be negative
    //incase they already connected to another.

    //or default to replicate all of local?

    //what will happen anyway? reload (from disk) vector of what feeds you received from
    //this remote, since last time. then, initialize replication of feeds which have changed since then.
    //if you are already replicating with another peer, request these feeds in non-sending mode.
    //they may switch to sending mode, or you might.

    //there needs to be a method to call, so that it's possible to request a new feed,
    //say if you follow someone new during the connection.
  }
}

