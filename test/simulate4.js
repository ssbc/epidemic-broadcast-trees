var u = require('../util')
var tape = require('tape')
var sim = require('../simulate')

//test 3 peers fully connected, so that some messages get sent twice
//these connections should get turned off.

function run (t, seed) {

  var a_log = [
    {author: 'a', sequence: 1, content: 'a'}/*,
    {author: 'a', sequence: 2, content: 'b'},
    {author: 'a', sequence: 3, content: 'c'}*/
  ]

  var network = {}
  network = sim.peer(network, 'A', a_log)
  network = sim.peer(network, 'B', [])
  network = sim.peer(network, 'C', [])
  network = sim.connection(network, 'A', 'B')
  network = sim.connection(network, 'B', 'C')
  network = sim.connection(network, 'A', 'C')

  //initialize

  var msglog = []

  network = sim.evolveNetwork(network, msglog, seed)

//  t.equal(msglog.filter(function (e) {
//    return u.isNote(e.data)
//  }).length, sim.countConnections(network)*2, 'exactly two notes are sent')
//
  t.ok(sim.isConsistent(network), 'Network is consistent')
  console.log(JSON.stringify(network, null, 2))

  //add one more item to A's log

  network.A.emit = {author: 'a', sequence: a_log.length+1, content: 'LIVE'}

  t.ok(sim.hasWork(network.A, network.A.connections.B))
  network = sim.evolveNetwork(network, msglog, seed*2)
  t.ok(sim.isConsistent(network))

  //add one more item to A's log

  network.A.emit = {author: 'a', sequence: a_log.length+1, content: 'LIVE'}

  t.ok(sim.hasWork(network.A, network.A.connections.B))
  network = sim.evolveNetwork(network, msglog, seed*2)
  t.ok(sim.isConsistent(network))


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



