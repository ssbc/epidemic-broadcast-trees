var states = require('../state')
var tape = require('tape')


tape('states', function (t) {

  var local = {}
  local[1] = 2

  var _state = states.receiveMessage({
    receiving: true, local: local, has: null
  }, {sequence: 3})

  t.deepEqual(_state, {
    receiving: true, local: local, has: 3
  })

  t.end()
})

tape('
