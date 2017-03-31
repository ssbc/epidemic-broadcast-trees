var u = require('../util')
var model = require('../model')
var states = require('../state')
var tape = require('tape')

var RNG = require('rng')

//state is {source, sink, nodeState, log, old_length}

function peer (network, id, log) {
  if(!log) log = []

  network[id] = {
    id: id, log: log, emit: false,
    connections: {}
  }

  return network
}

function connection (network, from, to) {
  network[from].connections[to] = {
    source: [], sink: [], nodeState: states.init(network[from].log.length),
    id: from, remote: to, log: network[from].log
  }
  network[to].connections[from] = {
    source: [], sink: [], nodeState: states.init(network[to].log.length),
    id: to, remote: from, log: network[to].log
  }
  return network
}

function countConnections (network) {
  //count unidirectional connections then divide by 2 to get duplex connections
  var uniplex = 0
  for(var k in network) {
    uniplex += Object.keys(network[k].connections).length
  }
  return uniplex / 2
}

function isConsistent (t, network) {
  for(var k in network)
    for(var j in network) {
      if(k != j)
        t.deepEqual(network[k].log, network[j].log, 'peer:'+k +' is consistent with :'+j)
    }
}

function hasWork (pState, cState) {
  return (
    pState.emit || cState.source.length ||
    cState.nodeState.ready != null ||
    cState.nodeState.effect != null
  )
}

function evolveNetwork (network, msglog, seed) {
  var rng = new RNG.MT(seed)

  function random () {
    return rng.random()
  }

  function isWaiting() {
    for(var k in network)
      for(var j in network[k].connections)
        if(hasWork(network[k], network[k].connections[j])) {
          return true
        }
  }

  function randomValue(obj) {
    var k = Object.keys(obj)
    return obj[k[~~(random()*k.length)]]
  }

  while(isWaiting()) {
    var pState = randomValue(network)
    var cState = randomValue(pState.connections)
    if(cState) {
      var r = model(pState, cState, random())
      pState = r[0]
      cState = r[1]

      if(cState.nodeState.local.tx == false)
        throw new Error('transmit should always be true inthis test')
      if(cState.nodeState.error) {
        throw new Error('error state')
      }
      //copy from the sink to the source immediately, since it gets read randomly anyway.
      if(cState.sink.length)
        console.log('send', cState.id+'->'+cState.remote, cState.sink)
      while(cState.sink.length) {
        if(cState.sink[0] == null) throw new Error('cannot send null')
        var data = cState.sink.shift()
        msglog.push({from: cState.id, to: cState.remote, data: data})
        network[cState.remote].connections[cState.id].source.push(data)
      }
    }
  }

  return network
}

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

  var network = {}
  network = peer(network, 'A', a_log)
  network = peer(network, 'B', [])
  network = connection(network, 'A', 'B')

  //initialize

  var msglog = []

  network = evolveNetwork(network, msglog, random())

  t.equal(msglog.filter(function (e) {
    return u.isNote(e.data)
  }).length, countConnections(network)*2, 'exactly two notes are sent')

  isConsistent(t, network)

  a_log.push({author: 'a', sequence: 4, content: 'LIVE'})

  network.A.emit = {author: 'a', sequence: 4, content: 'LIVE'}

  t.ok(hasWork(network.A, network.A.connections.B))

  network = evolveNetwork(network, msglog, random())
  isConsistent(t, network)

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

