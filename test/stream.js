
var Stream = require('../stream')
var S = require('../state')
var pull = require('pull-stream')

function Peer (logs) {

  return function () {
    var states = {}
    for(var k in logs)
      states[k] = S.init(logs[k].length)

    var stream = Stream(states, function get (id, seq, cb) {
      cb(null, logs[id][seq - 1])
    }, function append (msg, cb) {
      logs[msg.author].push(msg)
      stream.onAppend(msg)
      cb()
    })
    return stream
  }
}

var alice = [
  {author: 'alice', sequence: 1, content: 'foo'},
  {author: 'alice', sequence: 2, content: 'bar'},
  {author: 'alice', sequence: 3, content: 'baz'}
]
var bob = [
  {author: 'bob', sequence: 1, content: 'X'},
  {author: 'bob', sequence: 2, content: 'Y'},
  {author: 'bob', sequence: 3, content: 'Z'}
]

var alice_db, bob_db
var alice_stream = Peer(alice_db = {alice: alice, bob: []}) ()
var bob_stream = Peer(bob_db = {alice: [], bob: bob}) ()

function log (name) {
  return pull.through(function (data) {
    console.log(name, data)
  })
}

pull(
  alice_stream,
  log('a->b'),
  bob_stream,
  log('b->a'),
  alice_stream
)



console.log(alice_db)
console.log(bob_db)










