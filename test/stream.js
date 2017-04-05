var tape = require('tape')
var Stream = require('../')
var S = require('../state')
var pull = require('pull-stream')



function Peer (logs) {
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
      states,
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
      },
      console.log,
      cb
    )

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




