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

//var hasWork = exports.hasWork = function hasWork (pState, cState) {
//  return (
//    pState.emit || cState.source.length ||
//    cState.nodeState.ready != null ||
//    cState.nodeState.effect != null
//  )
//}
//

function allEvents (network) {
  var evs = []
  for(var k in network)
    evs = evs.concat(events(network[k]))
  return evs
}

//var createHash = require('crypto').createHash
//function hash (net) {
//  return createHash('sha256').update(JSON.stringify(net)).digest('hex').substring(0, 16)
//}

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
//      while(cState.sink.length) {
//        if(cState.sink[0] == null) throw new Error('cannot send null')
//        var data = cState.sink.shift()
//        msglog.push({from: cState.id, to: cState.remote, data: data})
//        network[cState.remote].connections[cState.id].source.push(data)
//      }
//
    }
  }
  return network
}

