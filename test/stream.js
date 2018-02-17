

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
    setClock: function () {},
    getAt: function (pair, cb) {
      if(!store[pair.id] || !store[pair.id][pair.sequence]) cb(new Error('not found'))
      else cb(null, store[pair.id][pair.sequence])
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

  console.log('initial.alice:',alice.progress())
  console.log('initial.bob  :',bob.progress())

  as.pipe(bs).pipe(as)


  alice.append({author: 'alice', sequence: 1, content: 'hello'}, function () {})
  bob.append({author: 'bob', sequence: 1, content: 'hello'}, function () {})

  console.log(bob.store)
  console.log(alice.store)

  console.log('final.alice:',alice.progress())
  console.log('final.bob  :',bob.progress())

  t.deepEqual(alice.store, bob.store)
  t.end()

})

test('a<->b,b', function (t) {

  var alice = create('alice')
  var bob = create('bob')

  alice.request('alice', true)
  alice.request('bob', true)
  bob.request('alice', true)
  bob.request('bob', true)

  var as = alice.createStream('bob')
  var bs = bob.createStream('alice')

  console.log('initial.alice:',alice.progress())
  console.log('initial.bob  :',bob.progress())

  as.pipe(bs).pipe(as)

  alice.append({author: 'alice', sequence: 1, content: 'hello'}, function () {})
  bob.append({author: 'bob', sequence: 1, content: 'hello'}, function () {})

  console.log(bob.store)
  console.log(alice.store)

  console.log('final.alice:',alice.progress())
  console.log('final.bob  :',bob.progress())

  t.deepEqual(alice.store, bob.store)

  var bs2 = bob.createStream('alice')
  var as2 = alice.createStream('bob')

  as2.pipe(bs2).pipe(as2)

  bob.append({author: 'bob', sequence: 2, content: 'hello2'}, function () {})

  t.throws(function () {
    as.write({alice: -1, bob: -2})
  })
  t.equal(as.ended, true)
  t.equal(bs.ended, true)

  t.deepEqual(alice.store, bob.store)

  t.end()

})



