var u = require('../util')
var model = require('../model')
var states = require('../state')

//state is {source, sink, nodeState, log, old_length}

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

function random(obj) {
  var k = Object.keys(obj)
  return obj[k[~~(Math.random()*k.length)]]
}

while(isWaiting()) {
  var n = random(random(network))
  if(n) {
    n = model(n, Math.random())
    if(n.nodeState.error) {
      throw new Error('error state')
    }
    //copy from the sink to the source immediately, since it gets read randomly anyway.
    if(n.sink.length)
      console.log('send', n.id+'->'+n.remote, n.sink)
    while(n.sink.length) {
      if(n.sink[0] == null) throw new Error('cannot send null')
      network[n.remote][n.id].source.push(n.sink.shift())
    }
  }
}

console.log(JSON.stringify(network, null, 2))






