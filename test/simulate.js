
var tape = require('tape')

var model = require('./model')

tape('a3-> b0', function (t) {

  var ab = [], ba = []

  var a_log = [
    {author: 'alice', sequence: 1, content: 'hi'},
    {author: 'alice', sequence: 2, content: 'hello'},
    {author: 'alice', sequence: 3, content: 'houdy'}
  ]

  var b_log = []
  var a = model(ab, ba, a_log)
  var b = model(ba, ab, b_log)

  var states = { alice: a.state, bob: b.state }

  var transitions = [a, b]

  function process () {
    transitions.sort(function () { return Math.random() - 0.5 })
    for(var i = 0; i < transitions.length; i++)
      if(transitions[i]() !== false) return true //found a match
    return false
  }

  var i = 0
  console.log(i, states)
  while(process(i++))
    console.log(i, states)

  t.end()
})













