var tape = require('tape')
var Stream = require('../')
var S = require('../state')
var pull = require('pull-stream')



function Peer (logs, onRequest) {
  logs._append = logs._append || []

  function onAppend (msg) {
    for(var i = 0; i < logs._append.length; i++)
      logs._append[i](msg)
  }

  return function (cb) {
    var states = {}
    for(var k in logs)
      if(k[0] != '_')
        states[k] = logs[k].length

    var stream = Stream(
      function get (id, seq, cb) {
        cb(null, logs[id][seq - 1])
      },
      function append (msg, cb) {
        if(logs[msg.author] && msg.sequence == logs[msg.author].length + 1) {
          logs[msg.author].push(msg)
          onAppend(msg)
          cb()
        }
        else cb(new Error('could not append'))
      }
    ) ({
        seqs: states,
        onChange: console.log,
        onRequest: onRequest
      },
      cb)

    logs._append.push(stream.onAppend)

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

var charles = [
  {author: 'charles', sequence: 1, content: 'L'},
  {author: 'charles', sequence: 2, content: 'M'},
  {author: 'charles', sequence: 3, content: 'N'},
  {author: 'charles', sequence: 4, content: 'O'},
  {author: 'charles', sequence: 5, content: 'P'},
]

tape('two peers', function (t) {

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

  delete alice_db._append
  delete bob_db._append
  console.log(alice_db)
  console.log(bob_db)

  t.deepEqual(alice_stream.progress().sync, bob_stream.progress().sync)

  t.deepEqual(alice_db, bob_db, 'databases are consistent')
  t.end()
})

tape('three peers, two streams', function (t) {

  var alice_db = {alice: alice, bob: []}
  var bob_db = {alice: [], bob: bob}
  var charles_db = {alice: alice.slice(0, 2), bob: bob.slice(0, 1)}

  var alice_stream = Peer(alice_db) ()
  var bob_stream = Peer(bob_db) ()
  var bob_stream2 = Peer(bob_db) ()
  var charles_stream = Peer(charles_db) ()

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

  pull(
    bob_stream2,
    log('b->c'),
    charles_stream,
    log('b->c'),
    bob_stream2
  )

  delete alice_db._append
  delete bob_db._append
  delete charles_db._append

  console.log(alice_db)
  console.log(bob_db)
  console.log(charles_db)

  t.deepEqual(alice_db, bob_db, 'databases are consistent')
  t.deepEqual(alice_db, charles_db, 'databases are consistent')
  t.end()
})

tape('three peers, four streams', function (t) {

  var alice_db = {alice: alice, bob: []}
  var bob_db = {alice: [], bob: bob}
  var charles_db = {alice: alice.slice(0, 2), bob: bob.slice(0, 1)}

  var alice_stream = Peer(alice_db) ()
  var alice_stream2 = Peer(alice_db) ()
  var bob_stream = Peer(bob_db) ()
  var bob_stream2 = Peer(bob_db) ()
  var charles_stream = Peer(charles_db) ()
  var charles_stream2 = Peer(charles_db) ()

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

  pull(
    bob_stream2,
    log('b->c'),
    charles_stream,
    log('c->b'),
    bob_stream2
  )

  pull(
    alice_stream2,
    log('a->c'),
    charles_stream2,
    log('c->a'),
    alice_stream2
  )


  delete alice_db._append
  delete bob_db._append
  delete charles_db._append

  console.log(alice_db)
  console.log(bob_db)
  console.log(charles_db)

  t.deepEqual(alice_db, bob_db, 'databases are consistent')
  t.deepEqual(alice_db, charles_db, 'databases are consistent')
  t.end()
})


tape('source errors', function (t) {

  var create = Peer({alice: alice, bob: []})

  var err = new Error('test error')
  pull(
    pull.error(err),
    create(function (_err) {
      t.equal(_err, err)
      t.end()
    })
  )

})

tape('sink errors', function (t) {

  var create = Peer({alice: alice, bob: []})

  var err = new Error('test error')
    create(function (_err) {
      t.equal(_err, err)
      t.end()
    }).source(err, function (_err) {
      t.equal(_err, err)
    })

})

tape('stream when one peer does not follow', function (t) {
  var alice_db = {alice: alice}
  var bob_db = {alice: [], bob: bob}

  var alice_stream = Peer(alice_db, function (bob_id, seq) {
    t.equal(bob_id, 'bob')
    t.equal(seq, 3)
    bob_requested = true
  }) ()
  var bob_stream = Peer(bob_db, function () {}) ()

  pull(
    alice_stream,
    bob_stream,
    alice_stream
  )

  t.deepEqual(alice_db.alice, bob_db.alice, 'bob has replicated alice')
  t.notDeepEqual(alice_db.bob, bob_db.bob, 'alice has not replicated bob')
  t.ok(bob_requested)
  console.log(alice_stream.progress())
  alice_db.bob = []
  alice_stream.request('bob', 0)
  t.deepEqual(alice_db.bob, bob_db.bob)
  console.log(alice_stream.progress())
  console.log(alice_db)
  t.end()
})


tape('stream when one peer does not follow', function (t) {
  var alice_db = {alice: alice}
  var bob_db = {alice: [], bob: bob}

  var alice_stream = Peer(alice_db, function (bob_id, seq) {
    t.equal(bob_id, 'bob')
    t.equal(seq, 3)
    bob_requested = true
  }) ()
  var bob_stream = Peer(bob_db, function () {}) ()

  pull(
    alice_stream,
    bob_stream,
    alice_stream
  )

  t.ok(bob_requested)
  t.deepEqual(alice_db.alice, bob_db.alice, 'bob has replicated alice')
  t.notDeepEqual(alice_db.bob, bob_db.bob, 'alice has not replicated bob')

  console.log(alice_stream.progress())
  alice_db.bob = []
  alice_stream.request('bob', -1)
  t.notDeepEqual(alice_db.bob, bob_db.bob, 'alice has not replicated bob')

  console.log(alice_stream.progress())
  console.log(alice_db)
  t.end()
})

tape('alice blocks bob', function (t) {
  var alice_db = {alice: alice, bob: []}
  var bob_db = {alice: [], bob: bob}

  var alice_stream = Peer(alice_db) ()
  var bob_stream = Peer(bob_db) ()

  pull(
    alice_stream,
    pull.through(function (data) { console.log('alice>>', data) }),
    bob_stream,
    pull.through(function (data) { console.log('bob>>', data) }),
    alice_stream
  )
  console.log('REPLICATED', alice_stream.progress())

//  t.ok(bob_requested)
//  t.deepEqual(alice_db.alice, bob_db.alice, 'bob has replicated alice')
//  t.deepEqual(alice_db.bob, bob_db.bob, 'alice has replicated bob')
//
//  console.log(alice_stream.progress())

  t.deepEqual(
    alice_stream.progress(),
    {current: 10, start: 0, target: 10}
//    { sync: 2, feeds: 2, recv: 0, send: 0, total: 3, unknown: 0 }
  )

  alice_stream.request('bob', -1)
  var msg = {author: 'bob', sequence: 4, content: 'BLOCKED'}
  bob_db.bob.push(msg)
  bob_stream.onAppend(msg)

  var p = alice_stream.progress()
  console.log(p)
  t.equal(p.current, p.target)
  t.ok(p.target > 0)

  t.end()
})

tape('alice streams from bob and charles', function (t) {
  //note, bob and 
  var alice_db = {alice: alice, bob: [], charles: []}
  var bob_db = {alice: [], bob: bob, charles: []}
  var charles_db = {alice: [], bob: bob, charles: charles}

  var alice_stream = Peer(alice_db) ()
  var alice_stream2 = Peer(alice_db) ()
  var bob_stream = Peer(bob_db) ()
  var charles_stream = Peer(charles_db) ()

  pull(
    alice_stream,
    pull.through(function (data) { console.log('AB>', data) }),
    bob_stream,
    pull.through(function (data) { console.log('BA>', data) }),
    alice_stream
  )

  pull(
    alice_stream2,
    pull.through(function (data) { console.log('AC>', data) }),
    charles_stream,
    pull.through(function (data) { console.log('CA>', data) }),
    alice_stream2
  )

  console.log('REPLICATED', alice_stream.progress())

  t.end()
})


