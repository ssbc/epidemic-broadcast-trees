var states = require('./state')
var RNG = require('rng')
var deepEqual = require('deep-equal')
//state is {source, sink, nodeState, log, old_length}

var model = exports.model = function (pState, cState, random) {
  /*
    we want to handle appends (and thus validation) before handling any receives.
    we can handle get and send in parallel though.

  */

  var acts = {}
  //emit is shared
  if(pState.emit || cState.source.length || isMessage(cState.nodeState.effect)) //connection
    acts.ordered = true
  if(cState.nodeState.ready != null)
    acts.send = true
  if(isNote(cState.nodeState.effect))
    acts.get = true

  var keys = Object.keys(acts)

  var key = keys[~~(random*keys.length)]

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
    //this bit should fire an event on all the connection states
    if(pState.emit) {
      throw new Error('emit should not be handed in cstate')
//      var msg = pState.emit
//      pState.emit = null
//      cState.nodeState = states.appendMessage(cState.nodeState, msg)
    }
    else if(isMessage(cState.nodeState.effect)) {
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
  network[from].connections[to] = {
    source: [], sink: [], nodeState: states.init(network[from].log.length),
    id: from, remote: to,
  }
  network[to].connections[from] = {
    source: [], sink: [], nodeState: states.init(network[to].log.length),
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

var hasWork = exports.hasWork = function hasWork (pState, cState) {
  return (
    pState.emit || cState.source.length ||
    cState.nodeState.ready != null ||
    cState.nodeState.effect != null
  )
}

exports.evolveNetwork = function evolveNetwork (network, msglog, seed) {
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
    var rk = k[~~(random()*k.length)]
    return obj[rk]
  }

  while(isWaiting()) {
    var pState = randomValue(network)
    if(pState.emit) {
      var msg = pState.emit
      pState.emit = null
      if(msg.sequence > pState.log.length) {
        pState.log.push(msg)
        for(var k in pState.connections)
          pState.connections[k].nodeState = states.appendMessage(pState.connections[k].nodeState, msg)
      }
      else
        console.log("APPENDED TWICE")

    } else {
      var cState = randomValue(pState.connections)
      if(cState) {
        var r = model(pState, cState, random())
        pState = r[0]
        cState = r[1]

//        if(cState.nodeState.local.tx == false)
//          throw new Error('transmit should always be true in this test')
//
        if(cState.nodeState.error)
          throw new Error('error state')

        //copy from the sink to the source immediately, since it gets read randomly anyway.
        if(cState.sink.length)
          console.log('send', cState.id+'->'+cState.remote, cState.sink)

        if(isMessage(cState.effect)) {
          if(pState.emit) throw new Error('something already appening')
          pState.emit = cState.effect
          cState.effect = null
        }
        while(cState.sink.length) {
          if(cState.sink[0] == null) throw new Error('cannot send null')
          var data = cState.sink.shift()
          msglog.push({from: cState.id, to: cState.remote, data: data})
          network[cState.remote].connections[cState.id].source.push(data)
        }
      }
    }
  }
  return network
}






