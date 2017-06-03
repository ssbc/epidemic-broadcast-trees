var states = require('../state')
var tape = require('tape')
var u = require('../util')

function clone (obj) {
  return JSON.parse(JSON.stringify(obj))
}

tape('receive remote note before we sent ours', function (t) {

  var msg = {sequence: 3, author: 'alice', content: 'blah'}

  var state = states.init(2)
  t.equal(state.ready, 2) //assume that a request for message 2 has been sent.

  //we received their note, but have not sent ours yet.
  state = states.receiveNote(state, 1)

  t.equal(state.local.req, null)
  t.equal(state.remote.req, 1)

  t.deepEqual(state, {
    local: {seq: 2, req: null, tx: true},
    remote: {seq: null, req: 1, tx: true},
    ready: 2,
    effect: null
  })


  t.end()
})





