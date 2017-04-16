var u = require('../util')
var sim = require('../simulate')

sim.runner(process.argv[2], sim.basic(function (seed) {
  return sim.createRandomNetwork(10,20)
}))

//function run (t, seed) {
//  if(seed % 100 == 0)
//  console.log('seed', seed)
//
//  //generate a random network, with 10 nodes, plus 10 extra connections
//  //then send 10 messages over it.
//  var M = 10, N = 10, C = 10
////  var L = 5 + ~~(random()*5)
//
//  var a_log = []
//
//  for(var i = 0; i < M; i++)
//    a_log.push({author: 'A', sequence: a_log.length + 1, content: 'msg:'+letters[i]})
//
//  var network = {}
//  
//  network = sim.peer(network, 'A', a_log)

  //initialize

//  var msglog = []
//
//  network = sim.evolveNetwork(network, msglog, seed)
//
//  if(!sim.isConsistent(network)) {
//    sim.print_network(network)
//    var obj = {}
//    for(var k in network)
//      obj[k] = network[k].log.length + 1
//
//    msglog.forEach(function (op) {
//      console.log(op.from+'>'+op.to, op.data)
//    })
//
//    console.log(obj)
//    throw new Error('network not consistent')
//  }
//  //add one more item to A's log
//
//  network.A.emit = {author: 'a', sequence: a_log.length+1, content: 'LIVE'}
//
//  network = sim.evolveNetwork(network, msglog, seed*2)
//  if(!sim.isConsistent(network))
//    throw new Error('network not consistent')
//  //todo: make this a processable event log thing
//  network.A.emit = {author: 'a', sequence: a_log.length+1, content: 'LIVE'}
//
//  network = sim.evolveNetwork(network, msglog, seed*2)
//  if(!sim.isConsistent(network))
//    throw new Error('network not consistent')
//
//}
//
//if(process.argv[2])
//  tape('run 3 message test with 2 peers, seed:'+ (+process.argv[2]), function (t) {
//    run(t, +process.argv[2])
//    t.end()
//  })
//else
//  //running each test is O(Number of tests!)
//  tape('run 3 message test with 2 peers, seeds', function (t) {
//    for(var i = 0; i < 1000; i++) (function (i) {
//      try {
//        run(t, i)
//      } catch (err) {
//        console.log(i)
//        throw err
////        t.ok(false, 'failed on seed: '+i)
//      }
//    })(i)
//    t.end()
//  })
//
//
//
//
//
//
//



