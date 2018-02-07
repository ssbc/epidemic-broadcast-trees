

var createPeer = require('../')
var test = require('tape')

function create (id) {
  var store = {}

  function append (msg, cb) {
    store[msg.author] = store[msg.author] || []
    if(msg.sequence - 1 != store[msg.author].length)
      cb(new Error('out of order'))
    else {
      store[msg.author].push(msg)
      p.onAppend(msg)
      cb(null, msg)
    }
  }

  var p = createPeer({
    id: id,
    getClock: function (id, cb) {
      cb(null, {})
    },
    getAt: function (pair, cb) {
      if(!store[pair[0]] || !store[pair[0]][pair[1]]) cb(new Error('not found'))
      else cb(null, store[pair[0]][pair[1]])
    },
    append: append
  })
  p.store = store
  p.append = append
  return p
}

test('a<->b', function (t) {

  var alice = create('alice')
  var bob = create('bob')

  alice.request('alice', true)
  alice.request('bob', true)
  bob.request('alice', true)
  bob.request('bob', true)

  var as = alice.createStream('bob')
  var bs = bob.createStream('alice')

  as.pipe(bs).pipe(as)

  alice.append({author: 'alice', sequence: 1, content: 'hello'}, function () {})
  bob.append({author: 'bob', sequence: 1, content: 'hello'}, function () {})

  console.log(bob.store)
  console.log(alice.store)

  t.deepEqual(alice.store, bob.store)
  t.end()

})

