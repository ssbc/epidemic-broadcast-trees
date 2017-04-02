var u = require('../util')
var sim = require('../simulate')


function print_network (network) {
  for(var k in network) {
    var s = k + ': '
    for(var j in network) {
      s += k == j ? ' ' : network[k].connections[j] ? j : '.'
    }
    console.log(s)
  }
}

function isConnected (network) {
  var reach = {}
  ;(function search (k) {
    reach[k] = true
    for(var j in network[k].connections)
      if(!reach[j]) search(j)
  }(Object.keys(network)[0]))

  return Object.keys(network).length === Object.keys(reach).length
}

var tape = require('tape')
var letters = 'abcdefghijklmnopqrstuzwxyz'
var RNG = require('rng')
function run (t, seed) {
  if(seed % 100 == 0)
  console.log('seed', seed)
  var rng = new RNG.MT(seed)

  function random() {
    return rng.random()
  }

  var M = 10, N = 10, C = 10
//  var L = 5 + ~~(random()*5)

  var a_log = []

  for(var i = 0; i < M; i++)
    a_log.push({author: 'A', sequence: a_log.length + 1, content: 'msg:'+letters[i]})

  var network = {}
  
  network = sim.peer(network, 'A', a_log)

  for(var i = 1; i < N; i++) {
    var me = letters[i].toUpperCase()
    network = sim.peer(network, me, [])
    //at least one connection to a peer currently in the network, gaurantees a connected network.
    network = sim.connection(network, me, letters[~~((i-1)*random())].toUpperCase())
  }

//  network = sim.peer(network, 'B', [])
//  network = sim.peer(network, 'C', [])
//  network = sim.connection(network, 'A', 'B')
//  network = sim.connection(network, 'B', 'C')
//  network = sim.connection(network, 'A', 'C')

  for(var i = 0; i < C; i++) {
    var me = letters[i%N].toUpperCase()
    var other
    while(me == (other = letters[~~(random()*N)].toUpperCase()))
      ;
//    console.log(me,'-->',other)
    network = sim.connection(network, me, other)
  }

//  print_network(network)

  //initialize

  var msglog = []

  network = sim.evolveNetwork(network, msglog, seed)

  if(!sim.isConsistent(network)) {
    print_network(network)
    var obj = {}
    for(var k in network)
      obj[k] = network[k].log.length + 1
    msglog.forEach(function (op) {
      console.log(op.from+'>'+op.to, op.data)
    })
    console.log(obj)
    throw new Error('network not consistent')
  }
  //add one more item to A's log

  network.A.emit = {author: 'a', sequence: a_log.length+1, content: 'LIVE'}

  network = sim.evolveNetwork(network, msglog, seed*2)
  if(!sim.isConsistent(network))
    throw new Error('network not consistent')
  //todo: make this a processable event log thing
  network.A.emit = {author: 'a', sequence: a_log.length+1, content: 'LIVE'}

  network = sim.evolveNetwork(network, msglog, seed*2)
  if(!sim.isConsistent(network))
    throw new Error('network not consistent')

}

if(process.argv[2])
  tape('run 3 message test with 2 peers, seed:'+ (+process.argv[2]), function (t) {
    run(t, +process.argv[2])
    t.end()
  })
else
  //running each test is O(Number of tests!)
  tape('run 3 message test with 2 peers, seeds', function (t) {
    for(var i = 0; i < 1000; i++) (function (i) {
      try {
        run(t, i)
      } catch (err) {
        console.log(i)
        throw err
//        t.ok(false, 'failed on seed: '+i)
      }
    })(i)
    t.end()
  })

