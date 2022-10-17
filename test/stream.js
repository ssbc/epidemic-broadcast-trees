const createPeer = require('../')
const test = require('tape')

function create (id) {
  const store = {}

  function append (msg, cb) {
    store[msg.author] = store[msg.author] || []
    if (msg.sequence - 1 !== store[msg.author].length) { cb(new Error('out of order')) } else {
      store[msg.author].push(msg)
      p.onAppend(msg)
      cb(null, msg)
    }
  }

  const p = createPeer({
    id,
    getClock: function (id, cb) {
      cb(null, {})
    },
    setClock: function () {},
    getAt: function (pair, cb) {
      if (!store[pair.id] || !store[pair.id][pair.sequence]) cb(new Error('not found'))
      else cb(null, store[pair.id][pair.sequence])
    },
    append
  })
  p.store = store
  p.append = append
  return p
}

test('a<->b', function (t) {
  const alice = create('alice')
  const bob = create('bob')

  alice.request('alice', true)
  alice.request('bob', true)
  bob.request('alice', true)
  bob.request('bob', true)

  const as = alice.createStream('bob', 3, false)
  const bs = bob.createStream('alice', 3, true)

  console.log('initial.alice:', alice.progress())
  console.log('initial.bob  :', bob.progress())

  as.pipe(bs).pipe(as)

  alice.append({ author: 'alice', sequence: 1, content: 'hello' }, function () {})
  bob.append({ author: 'bob', sequence: 1, content: 'hello' }, function () {})

  console.log(bob.store)
  console.log(alice.store)

  console.log('final.alice:', alice.progress())
  console.log('final.bob  :', bob.progress())

  t.deepEqual(alice.store, bob.store)
  t.end()
})

test('a<->b,b', function (t) {
  const alice = create('alice')
  const bob = create('bob')

  alice.request('alice', true)
  alice.request('bob', true)
  bob.request('alice', true)
  bob.request('bob', true)

  const as = alice.createStream('bob', 3, true)
  const bs = bob.createStream('alice', 3, false)

  console.log('initial.alice:', alice.progress())
  console.log('initial.bob  :', bob.progress())

  as.pipe(bs).pipe(as)

  alice.append({ author: 'alice', sequence: 1, content: 'hello' }, function () {})
  bob.append({ author: 'bob', sequence: 1, content: 'hello' }, function () {})

  console.log(bob.store)
  console.log(alice.store)

  console.log('final.alice:', alice.progress())
  console.log('final.bob  :', bob.progress())

  t.deepEqual(alice.store, bob.store)

  t.end()
})

test('a3<->b3<->c2', function (t) {
  const alice = create('alice')
  const bob = create('bob')
  const charles = create('charles')

  alice.request('alice', true)
  alice.request('bob', true)
  bob.request('alice', true)
  bob.request('bob', true)
  charles.request('alice', true)
  charles.request('bob', true)

  const as3 = alice.createStream('bob', 3, true)
  const bs3 = bob.createStream('alice', 3, false)
  const bs2 = bob.createStream('charles', 3, false)
  const cs2 = charles.createStream('bob', 3, true)

  console.log('initial.alice:', alice.progress())
  console.log('initial.bob  :', bob.progress())
  console.log('initial.charles  :', charles.progress())

  as3.pipe(bs3).pipe(as3)
  cs2.pipe(bs2).pipe(cs2)

  alice.append({ author: 'alice', sequence: 1, content: 'hello' }, function () {})
  bob.append({ author: 'bob', sequence: 1, content: 'hello' }, function () {})

  console.log(bob.store)
  console.log(alice.store)

  console.log('final.alice:', alice.progress())
  console.log('final.bob  :', bob.progress())

  t.deepEqual(alice.store, bob.store)
  t.deepEqual(alice.store, charles.store)
  t.end()
})

test('a<-!>b', function (t) {
  const alice = create('alice')
  const bob = create('bob')

  alice.request('alice', true)
  alice.request('bob', true)
  alice.block('alice', 'bob', true)
  bob.request('alice', true)
  bob.request('bob', true)

  const as = alice.createStream('bob', 3, false)
  const bs = bob.createStream('alice', 3, true)

  as.pipe(bs).pipe(as)

  t.equal(as.ended, true)
  t.equal(bs.ended, true)
  t.end()
})

test('a<->b...!', function (t) {
  const alice = create('alice')
  const bob = create('bob')

  alice.request('alice', true)
  alice.request('bob', true)
  bob.request('alice', true)
  bob.request('bob', true)

  const as = alice.createStream('bob', 3, false)
  const bs = bob.createStream('alice', 3, true)

  as.pipe(bs).pipe(as)

  t.equal(as.ended, false)
  t.equal(bs.ended, false)

  alice.block('alice', 'bob', true)
  console.log(as.peer.state)
  t.equal(as.ended, true)
  t.equal(bs.ended, true)
  t.end()
})

test('b<-!->a', function (t) {
  const alice = create('alice')
  const bob = create('bob')

  alice.request('alice', true)
  alice.request('bob', true)
  alice.block('alice', 'bob', true)
  bob.request('alice', true)
  bob.request('bob', true)

  const as = alice.createStream('bob', 3, true)
  const bs = bob.createStream('alice', 3, false)

  as.pipe(bs).pipe(as)

  t.equal(as.ended, true)
  t.equal(bs.ended, true)
  t.end()
})
