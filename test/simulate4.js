var u = require('../util')
var tape = require('tape')
var sim = require('../simulate')

//test 3 peers fully connected, so that some messages get sent twice
//these connections should get turned off.

function run (t, seed) {

  var a_log = [
    {author: 'a', sequence: 1, content: 'a'},
    {author: 'a', sequence: 2, content: 'b'}/*,
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

  if(!sim.isConsistent(network))
    throw new Error('network not consistent')

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
    for(var i = 0; i < 10000; i++) (function (i) {
      try {
      run(t, i)
      } catch(err) {
        console.log('error on seed:'+i)
        throw err
      }
    })(i)
    t.end()
  })

