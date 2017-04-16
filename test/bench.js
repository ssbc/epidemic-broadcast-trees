var pull = require('pull-stream')
var ex = require('../example')

//var model_a = ex.create()


var tape = require('tape')

tape('simple', function (t) {
  var alice = ex.createChatModel('alice', [])
  var bob = ex.createChatModel('bob')

  var as = ex.createStream(alice)
  var bs = ex.createStream(bob)

  pull(as, bs, as)

  var msg = {author: 'alice', sequence: 1, content: 'hello bob!', timestamp: Date.now()}

  //have bob get ready to receive something
  bob.onAppend(function (_msg) {
    console.log('msg at bob:', _msg)
    t.deepEqual(_msg, msg)
    t.end()
  })

  //have alice send a message to bob
  alice.append(msg)

})

function init(model, N, M) {
  for(var i = 0; i < N; i++)
    model.logs['peer'+i] = []

  for(var i = 0; i < M; i++) {
    var k = 'peer'+~~(Math.random()*N)
    model.logs[k].push({
      author: k, sequence: model.logs[k].length + 1, content: 'hello:'+Math.random()
    })
  }
}

tape('simple', function (t) {
  var alice = ex.createChatModel()
  var bob = ex.createChatModel()

  init(alice, 10, 100)

  var as = ex.createStream(alice)
  var bs = ex.createStream(bob)

  function log(name) {
    return pull.through(function (data) {
      console.log(name, data)
    })
  }

  pull(as, bs, as)

  //because everything is sync, it should be complete already.

  t.deepEqual(bob.logs, alice.logs)
  t.end()
//  console.log(alice.logs)
})


tape('simple', function (t) {
  var alice = ex.createChatModel()
  var bob = ex.createChatModel()

  init(alice, 1000, 100000)

  var as = ex.createStream(alice)
  var bs = ex.createStream(bob)

  function log(name) {
    return pull.through(function (data) {
      console.log(name, data)
    })
  }
  var c = 0, start = Date.now()
  bob.onAppend(function () {
    if(!(c++ % 1000))
      console.log(c, Date.now() - start)
  })

  pull(as, bs, as)

  //because everything is sync, it should be complete already.

  var seconds = ((Date.now() - start)/1000)
  console.log(c, seconds, c / seconds)

  t.deepEqual(bob.logs, alice.logs)
  t.end()
//  console.log(alice.logs)
})

