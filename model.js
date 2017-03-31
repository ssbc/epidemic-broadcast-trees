var states = require('./state')

//state is {source, sink, nodeState, log, old_length}

function hasWork (state) {
  return (
    state.emit || state.source.length ||
    state.nodeState.ready != null ||
    state.nodeState.effect != null
  )
}

module.exports = function (state, random) {
  var ops = state.ops

  /*
    we want to handle appends (and thus validation) before handling any receives.
    we can handle get and send in parallel though.

  */

  var acts = {}
  if(state.emit || state.source.length || isMessage(state.nodeState.effect))
    acts.ordered = true
  if(state.nodeState.ready != null)
    acts.send = true
  if(isNote(state.nodeState.effect))
    acts.get = true

  var keys = Object.keys(acts)

  var key = keys[~~(random*keys.length)]

  if(key === 'send') {
    var data = state.nodeState.ready
    state.sink.push(data)
    state.nodeState = states.read(state.nodeState)
  }
  else if(key === 'get') {
    var msg = state.log[state.nodeState.effect - 1]
    state.nodeState.effect = null
    state.nodeState = states.gotMessage(state.nodeState, msg)
  }
  else if(key == 'ordered'){
    if(state.emit) {
      var msg = state.emit
      state.emit = null
      state.nodeState = states.appendMessage(state.nodeState, msg)
    }
    else if(isMessage(state.nodeState.effect)) {
      state.emit = state.nodeState.effect
      state.log.push(state.emit)
      state.nodeState.effect = null
    }
    else if(state.source.length) {
      var data = state.source.shift()
      if(data == null) throw new Error('should never read null/undefined from network')
      state.nodeState = (isMessage(data) ? states.receiveMessage : states.receiveNote)(state.nodeState, data)
    }
    else throw new Error('should not have ran out of options')
  }
//  else {
//    console.log(state, acts)
//    throw new Error('attempted to run transition, when nothing to be done')
//  }
  return state
}

function isMessage(data) { return data && 'object' === typeof data }
function isNote(n) { return Number.isInteger(n) }

