var states = require('./state')

//state is {source, sink, nodeState, log, old_length}

function hasWork (state) {
  return (
    state.emit || state.source.length ||
    state.nodeState.ready != null ||
    state.nodeState.effect != null
  )
}

module.exports = function (pState, cState, random) {
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
      var msg = pState.emit
      pState.emit = null
      cState.nodeState = states.appendMessage(cState.nodeState, msg)
    }
    else if(isMessage(cState.nodeState.effect)) {
      pState.emit = cState.nodeState.effect
      pState.log.push(pState.emit) //shared
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


