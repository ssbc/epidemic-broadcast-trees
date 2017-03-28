var u = require('../util')
var states = require('../state')

module.exports = function (source, sink, log) {
  var state = states.init(log.length)
  var transitions = [
    function receive () {
      var data = null
      if(!source.length) return false
      console.log(source)

      data = source.unshift()
      if(u.isMessage(data))
        state = states.receiveMessage(state, data)
      else if(u.isNote(data))
        state = states.receiveNote(state, data)
      else
        throw new Error('should never happen:'+JSON.stringify(data))
    },
    function read () {
      if(state.ready == null) return false

      sink.push(state.ready)
      state = states.read(state)
      if(state.effect && state.effect.name == 'get')
        console.log(state)
      return true
    },
    function effect () {
      if(!state.effect) return false

      if(state.effect.action === 'append') {
        var msg = state.effect.value
        state.effect.value = null
        log.push(msg)
        state = states.appendMessage(state, msg)
      }
      else if(state.effect.action === 'get') {
        var msg = log[state.effect.value]
        state = states.gotMessage(state, msg)
      }
      else throw new Error('unknown effect')
    }
  ]

  //given that we are processing this node, test each possible transition in a random order.
  function process () {
    transitions.sort(function () { return Math.random() - 0.5 })
    for(var i = 0; i < transitions.length; i++)
      if(transitions[i]() !== false) {
        console.log(transitions[i].name)
        return true //found a match
      }
    return false
  }

  process.state = state

  return process
}














