var pull = require('pull-stream')
var createEbtStream = require('./')
var Obv = require('obv')
//create a datamodel for a reliable chat room.

function createChatModel (id, log) {
  //in this example, logs can be a map of arrays,
  var logs = {}
  if(id) logs[id] = log || []

  var onAppend = Obv()
  return {
    logs: logs,
    append: function append (msg) {
      (logs[msg.author] = logs[msg.author] || []).push(msg)
      onAppend.set(msg)
    },
    onAppend: onAppend
  }
}

function createStream(chat) {

  //so the vector clock can be
  var vectorClock = {}
  for(var k in chat.logs)
    vectorClock[k] = chat.logs[k].length

  //observables are like an event emitter but with a stored value
  //and only one value per instance (instead of potentially many named events)


  var stream = createEbtStream(
    vectorClock,
    //pass a get(id, seq, cb)
    function (id, seq, cb) {
      if(!chat.logs[id] || !chat.logs[id][seq-1])
        return cb(new Error('not found'))
      cb(null, chat.logs[id][seq-1])
    },
    //pass append(msg, cb)
    function (msg, cb) {
      chat.append(msg)
      cb()
    }
  )

  chat.onAppend(stream.onAppend)

  return stream
}

if(!module.parent) {

  var alice = createChatModel('alice', [])
  var bob = createChatModel('bob')

  var as = createStream(alice)
  var bs = createStream(bob)

  pull(as, bs, as)

  //have bob get ready to receive something
  bob.onAppend(function (msg) {
    console.log('msg at bob:', msg)
  })

  //have alice send a message to bob
  alice.append({author: 'alice', sequence: 1, content: 'hello bob!'})

}

exports.createChatModel = createChatModel
exports.createStream = createStream


