var createSimulator = require('./simulator')
var bipf = require("bipf")
var events = require('../events')(require('../v3'))

function encode(data) {
  var len = bipf.encodingLength(data)
  var b = Buffer.alloc(len)
  bipf.encode(data, b, 0)
  return b
}

function getMsgAuthor(msg) {
  var p = 0 // note you pass in p!
  p = bipf.seekKey(msg, p, Buffer.from('author'))
  return bipf.decode(msg, p)
}

function getMsgSequence(msg) {
  var p = 0 // note you pass in p!
  p = bipf.seekKey(msg, p, Buffer.from('sequence'))
  return bipf.decode(msg, p)
}

events.getMsgAuthor = getMsgAuthor
events.getMsgSequence = getMsgSequence

var test = require('tape')

test('binary test', function (t) {
  var tick = createSimulator(0, true, events)

  var network = {}
  var alice = network['alice'] = tick.createPeer('alice')
  var bob = network['bob'] = tick.createPeer('bob')

  alice.append = function(msg) {
    var ary = alice.store[getMsgAuthor(msg)] = alice.store[getMsgAuthor(msg)] || []
    if(getMsgSequence(msg) === ary.length + 1) {
      ary.push(msg)
      alice.state = events.append(alice.state, msg)
    }
  }
  bob.append = function(msg) {
    var ary = bob.store[getMsgAuthor(msg)] = bob.store[getMsgAuthor(msg)] || []
    if(getMsgSequence(msg) === ary.length + 1) {
      ary.push(msg)
      bob.state = events.append(bob.state, msg)
    }
  }
  
  alice.init({})
  bob.init({})

  alice.append(encode({author: 'alice', sequence: 1, text: "test"}))
  alice.append(encode({author: 'alice', sequence: 2, text: "test2"}))
  alice.append(encode({author: 'alice', sequence: 3, text: "test3"}))

  alice.follow('alice')
  bob.follow('alice')

  alice.connect(bob)

  while(tick(network)) ;

  t.deepEqual(bob.store, alice.store)
  t.end()
})
