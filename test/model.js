var u = require('../util')
var model = require('../model')
var states = require('../state')
var tape = require('tape')

var RNG = require('rng')

//state is {source, sink, nodeState, log, old_length}

function run (t, seed) {

  var rng = new RNG.MT(seed)

  function random () {
    return rng.random()
  }

  var a_log = [
    {author: 'a', sequence: 1, content: 'a'},
    {author: 'a', sequence: 2, content: 'b'},
    {author: 'a', sequence: 3, content: 'c'}
  ]

  var ab_state = {
    source: [], sink:[], nodeState: states.init(3),
    log: a_log, remote: 'B', id: 'A'
  }

  //var ac_state = {
  //  source: [], sink:[], nodeState: states.init(3),
  //  log: a_log, remote: 'C', id: 'A'
  //}
  //

  var b_log = []
  var ba_state = {
    source: [], sink:[], nodeState: states.init(0),
    log: b_log, remote: 'A', id: 'B'
  }

  //var bc_state = {
  //  source: [], sink:[], nodeState: states.init(0),
  //  log: b_log, remote: 'C', id: 'B'
  //}
  //var c_log = []
  //var ca_state = {
  //  source: [], sink:[], nodeState: states.init(0),
  //  log: c_log, remote: 'A', id: 'C'
  //}
  //var cb_state = {
  //  source: [], sink:[], nodeState: states.init(0),
  //  log: c_log, remote: 'A', id: 'C'
  //}

  var network = {
    A: {
      B: ab_state,
  //    C: ac_state
    },
    B: {
      A: ba_state,
  //    C: bc_state
    },
  //  C: {A: ca_state, B: cb_state}
  }

  //initialize

  function hasWork (state) {
    return (
      state.emit || state.source.length ||
      state.nodeState.ready != null ||
      state.nodeState.effect != null
    )
  }

  function isWaiting() {
    for(var k in network)
      for(var j in network[k])
        if(hasWork(network[k][j])) {
          return true
        }
  }

  function randomValue(obj) {
    var k = Object.keys(obj)
    return obj[k[~~(random()*k.length)]]
  }

  var msglog = []

  while(isWaiting()) {
    var n = randomValue(randomValue(network))
    if(n) {
      n = model(n, random())
      if(n.nodeState.error) {
        throw new Error('error state')
      }
      //copy from the sink to the source immediately, since it gets read randomly anyway.
      if(n.sink.length)
        console.log('send', n.id+'->'+n.remote, n.sink)
      while(n.sink.length) {
        if(n.sink[0] == null) throw new Error('cannot send null')
        var data = n.sink.shift()
        msglog.push({from: n.id, to: n.remote, data: data})
        network[n.remote][n.id].source.push(data)
      }
    }
  }
  console.log(JSON.stringify(network, null, 2))

  console.log(msglog)

  t.deepEqual(msglog.filter(function (e) {
    return u.isNote(e.data)
  }).map(function (e) { return e.data }).sort(), [0, 3], 'exactly two notes are sent')
  t.ok(u.isNote(msglog[0].data), 'first message must be note')
  t.ok(u.isNote(msglog[1].data), 'second message must be note')


//  return {network: network, msglog: msglog}
}

if(process.argv[2])
  tape('run 3 message test with 2 peers, seed:'+ (+process.argv[2]), function (t) {
    run(t, +process.argv[2])
    t.end()
  })
else
for(var i = 0; i < 100; i++) (function (i) {
  tape('run 3 message test with 2 peers, seed:'+i, function (t) {
    run(t, i)
    t.end()
  })
})(i)



