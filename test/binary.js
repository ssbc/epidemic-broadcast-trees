const createSimulator = require('./simulator')
const bipf = require('bipf')
const events = require('../events')(require('../v3'))

function encode (data) {
  const len = bipf.encodingLength(data)
  const b = Buffer.alloc(len)
  bipf.encode(data, b, 0)
  return b
}

function getMsgAuthor (msg) {
  let p = 0 // note you pass in p!
  p = bipf.seekKey(msg, p, Buffer.from('author'))
  return bipf.decode(msg, p)
}

function getMsgSequence (msg) {
  let p = 0 // note you pass in p!
  p = bipf.seekKey(msg, p, Buffer.from('sequence'))
  return bipf.decode(msg, p)
}

events.getMsgAuthor = getMsgAuthor
events.getMsgSequence = getMsgSequence

const test = require('tape')

test('binary test', function (t) {
  const tick = createSimulator(0, true, events)

  const network = {}
  const alice = network.alice = tick.createPeer('alice')
  const bob = network.bob = tick.createPeer('bob')

  alice.append = function (msg) {
    const ary = alice.store[getMsgAuthor(msg)] = alice.store[getMsgAuthor(msg)] || []
    if (getMsgSequence(msg) === ary.length + 1) {
      ary.push(msg)
      alice.state = events.append(alice.state, msg)
    }
  }
  bob.append = function (msg) {
    const ary = bob.store[getMsgAuthor(msg)] = bob.store[getMsgAuthor(msg)] || []
    if (getMsgSequence(msg) === ary.length + 1) {
      ary.push(msg)
      bob.state = events.append(bob.state, msg)
    }
  }

  alice.init({})
  bob.init({})

  alice.append(encode({ author: 'alice', sequence: 1, text: 'test' }))
  alice.append(encode({ author: 'alice', sequence: 2, text: 'test2' }))
  alice.append(encode({ author: 'alice', sequence: 3, text: 'test3' }))

  alice.follow('alice')
  bob.follow('alice')

  alice.connect(bob)

  while (tick(network)) ;

  t.deepEqual(bob.store, alice.store)
  t.end()
})
