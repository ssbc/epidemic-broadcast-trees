'use strict'
var states = require('./state')
var RNG = require('rng')
var deepEqual = require('deep-equal')
var invariants = require('./invariants')
//state is {source, sink, nodeState, log, old_length}

var events = exports.events = function (pState) {
  var ev = []
  //database changing state, for the peer.
  if(pState.emit)
    ev.push({name: 'append', peer: pState.id})

  //otherwise, normal states can change,
  //except ORDERED states are blocked by the database op.
  for(var k in pState.connections) {
    var cState = pState.connections[k]
    if(!pState.emit && (cState.source.length || isMessage(cState.nodeState.effect)))
      ev.push({name: 'ordered', peer: pState.id, connection: k})
    if(cState.nodeState.ready != null)
      ev.push({name: 'send', peer: pState.id, connection: k})
    if(isNote(cState.nodeState.effect))
      ev.push({name: 'get', peer: pState.id, connection: k})
  }
  return ev
}

var model2 = exports.model2 = function (pState, cState, key) {
  /*
    we want to handle appends (and thus validation) before handling any receives.
    we can handle get and send in parallel though.

  */

  invariants(cState)

  if(key === 'send') {
    var data = cState.nodeState.ready
    cState.sink.push(data)
    cState.nodeState = states.read(cState.nodeState)
  }
  else if(key === 'get') {
    var msg = pState.log[cState.nodeState.effect - 1] //shared
    cState.nodeState.effect = null
    cState.nodeState = states.gotMessage(cState.nodeState, msg)
  }
  else if(key == 'ordered'){
    //can only be processed if pstate.emit is null
    if(isMessage(cState.nodeState.effect)) {
      pState.emit = cState.nodeState.effect
      //pState.log.push(pState.emit) //shared
      cState.nodeState.effect = null
    }
    else if(cState.source.length) {
      var data = cState.source.shift() //connection.
      if(data == null) throw new Error('should never read null/undefined from network')
      cState.nodeState = (isMessage(data) ? states.receiveMessage : states.receiveNote)(cState.nodeState, data)
    }
    else throw new Error('should not have ran out of options')
  }

  invariants(cState)

  return [pState, cState]
}

function isMessage(data) { return data && 'object' === typeof data }
function isNote(n) { return Number.isInteger(n) }

exports.peer = function peer (network, id, log) {
  if(!log) log = []

  network[id] = {
    id: id, log: log, emit: false,
    connections: {}
  }

  return network
}

exports.connection = function connection (network, from, to) {
  if(!network[from]) throw new Error('from peer:'+ from + ' does not exist')
  if(!network[to]) throw new Error('from peer:'+ to + ' does not exist')
  var ab = [], ba = []
  network[from].connections[to] = {
    source: ab, sink: ba, nodeState: states.init(network[from].log.length),
    id: from, remote: to,
  }
  network[to].connections[from] = {
    source: ba, sink: ab, nodeState: states.init(network[to].log.length),
    id: to, remote: from,
  }
  return network
}

exports.countConnections = function countConnections (network) {
  //count unidirectional connections then divide by 2 to get duplex connections
  var uniplex = 0
  for(var k in network) {
    uniplex += Object.keys(network[k].connections).length
  }
  return uniplex / 2
}

exports.isConsistent = function isConsistent (network) {
  //this is the "handshaking lemma" if I recall
  var keys = Object.keys(network)
  for(var i = 0; i < keys.length; i++) {
    var k = keys[i]
    for(var j = i+1; j < keys.length; j++) {
      var l = keys[j]
      if(!deepEqual(network[k].log, network[l].log, 'peer:'+k +' is consistent with :'+j))
        return false
    }
  }
  return true
}

function allEvents (network) {
  var evs = []
  for(var k in network)
    evs = evs.concat(events(network[k]))
  return evs
}

exports.evolveNetwork = function evolveNetwork (network, msglog, seed) {
  var eventlog = []
  var rng = new RNG.MT(seed)

  function random () {
    return rng.random()
  }

  function randomValue(obj) {
    var k = Object.keys(obj)
    var rk = k[~~(random()*k.length)]
    return obj[rk]
  }

  var evs
  var N = 1, choice = [], base = []
  while((evs = allEvents(network)).length) {
    base.push(evs.length)
    var r = ~~(evs.length*random())
    choice.push(r)
    N = N*evs.length + r

    var event = evs[r]
    var pState = network[event.peer]
    eventlog.push(event)
    if(event.name == 'append') {
      var msg = pState.emit
      pState.emit = null

      if(msg.sequence > pState.log.length) {
        pState.log.push(msg)
        for(var k in pState.connections) {
          invariants(pState.connections[k])
          pState.connections[k].nodeState = states.appendMessage(pState.connections[k].nodeState, msg)
          invariants(pState.connections[k])
        }

      }

    }
    else {
      var cState = pState.connections[event.connection]
      invariants(cState)

      var s = model2(pState, cState, event.name)
      invariants(s[1])
      pState = s[0]; cState = s[1]; 
      if(cState.nodeState.error) {
        console.log(JSON.stringify(pState, null, 2))
        console.log('evs', evs, event)
        console.log('msglog', msglog)
        console.log('eventlog', eventlog)
        throw new Error('error state')
      }
      if(isMessage(cState.effect)) {
        if(pState.emit) throw new Error('something already appening')
        pState.emit = cState.effect
        cState.effect = null
      }
    }
  }
  return network
}


exports.runner = function (seed, run) {
  var tape = require('tape')
  var max = 1000

  if(seed)
    tape('run 3 message test with 2 peers, seed:'+ (+seed), function (t) {
      run(t, +seed)
      t.end()
    })
  else
    //running each test is O(Number of tests!)
    tape('run 3 message test with 3 peers, seeds'+0+'-'+max, function (t) {
      for(var i = 0; i < max; i++) (function (i) {
        if(!(i%100)) console.log('seed:'+i)
        try {
        run(t, i)
        } catch(err) {
          console.log('error on seed:'+i)
          throw err
        }
      })(i)
      t.end()
    })

}

//test 3 peers fully connected, so that some messages get sent twice
//these connections should get turned off.

function createLogs(n) {
  var log = []
  for(var i = 0; i < n; i++)
    log.push({author: 'a', sequence: i+1, content: 'hi:'+i.toString(36)})
  return log
}

function createPeers(network, N) {
  for(var i = 0; i < N; i++) {
    var id = String.fromCharCode('A'.charCodeAt(0) + i)
    network = exports.peer(network, id, [])
  }
  return network
}

function createConnections (network, list) {
  list.split(',').map(function (ab) {
    if(ab)
      network = exports.connection(network, ab[0], ab[1])
  })
  return network
}


var letters = 'abcdefghijklmnopqrstuzwxyz'.toUpperCase()
//create random network with N nodes and E edges
exports.createRandomNetwork = function createRandomNetwork(N, E, seed) {

  if(E < N -1) throw new Error(
    'not enough edges:'+E+
    ' to connect a network with:'+N +' nodes. '+
    'At least '+N-1+' are required.'
  )

  var rng = new RNG.MT(seed)

  function random() {
    return rng.random()
  }
  var network = {}
  network = exports.peer(network, 'A')

  //create N-1 more peers
  //connect them randomly (but gaurantee a connected graph)
  for(var i = 1; i < N; i++) {
    var me = letters[i]
    network = exports.peer(network, me, [])
    //at least one connection to a peer currently in the network, gaurantees a connected network.
    network = exports.connection(network, me, letters[~~((i-1)*random())])
  }

  for(var i = 0; i < E-N; i++) {
    var me = letters[i%N]
    var other
    while(me == (other = letters[~~(random()*N)]))
      ;
    network = exports.connection(network, me, other)
  }

  return network
}

exports.createSimulation = function (M, N, C) {
  var network = {}
  var a_log =  createLogs(M)
  network = createPeers(network, N)
  network.A.log = a_log //first peer is always alice
  return createConnections(network, C)
}

//run a test with M messages over N peers, returning 
exports.basic = function (createNetwork) {
  return function (t, seed) {
    var msglog = []

    var network = createNetwork(seed)

    network = exports.evolveNetwork(network, msglog, seed)

    if(!exports.isConsistent(network))
      throw new Error('network not consistent')

    //add one more item to A's log

    network.A.emit = {author: 'a', sequence: network.A.log.length+1, content: 'LIVE'}

    network = exports.evolveNetwork(network, msglog, seed*2)
    if(!exports.isConsistent(network))
      throw new Error('network not consistent')
    //todo: make this a processable event log thing
    network.A.emit = {author: 'a', sequence: network.A.log.length+1, content: 'LIVE'}

    network = exports.evolveNetwork(network, msglog, seed*2)
    if(!exports.isConsistent(network))
      throw new Error('network not consistent')

    return msglog
  }
}

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

