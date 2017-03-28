var tape = require('tape')

//take two initial states

var states = require('../state')

function postAssert(state) {
  function a(k) {
    if(isNaN(state[k]))
      throw new Error(k+ ' is NaN!')
  }
  //boolean, or null
  a('sending');
  a('receiving');

  //integers, or null
  a('requested');
  a('sent');
  a('received');

}

tape('replicate 3 messages from a', function (t) {

  var b_log = []

  var a_log = [
    {author: 'alice', sequence: 1, content: 'A-one'},
    {author: 'alice', sequence: 2, content: 'A-two'},
    {author: 'alice', sequence: 3, content: 'A-three'}
  ]

  var data = null

  function append(state, log) {
    if(!state.effect || state.effect.action !== 'append')
      throw new Error('expected append effect')
    var msg = state.effect.value
    log.push(state.effect.value)
    state.local.alice ++
    state.effect = null
    return msg
  }

  function get(state, log) {
    t.equal(state.effect.action, 'get')
    var msg = log[state.effect.value - 1]
    state.effect = null
    return msg
  }

//  function send (state) {
//    var data = state.ready
//    state.ready = null
//    return data
//  }

  var a = states.init (2)
  var b = states.init (0)

  //a requests's b's feed

  //should be set by init.
//  a.ready = 2
//  b.ready = 0
  t.equal(a.ready, 2)
  t.equal(b.ready, 0)

  data = a.ready
  a = states.read(a)
    t.equal(a.requested, 2)
  b = states.receiveNote(b, data)
  console.log(a)
  postAssert(a);
  console.log(b)
  postAssert(b)

  t.notOk(a.sending)
  t.ok(b.sending) //except b doesn't have the message to send

  //send a note
  data = b.ready
  b = states.read(b, 'bob')
  a = states.receiveNote(a, data)

    console.log(b)
    postAssert(b)
    console.log(a)
    postAssert(a);
    console.log(b)
    postAssert(b)

    t.ok(a.sending)
    t.ok(b.sending) //except b doesn't have the message to send

    t.deepEqual(a.effect, {action: 'get', value: 1})

  a = states.gotMessage(a, get(a, a_log))
    t.equal(a.effect, null)
    t.deepEqual(a.ready, a_log[0])

  data = a.ready
  a = states.read(a)
    t.deepEqual(a.effect, {action: 'get', value: 2})
  b = states.receiveMessage(b, data)
    postAssert(a);
    postAssert(b)

    t.deepEqual(b.effect, {action: 'append', value: a_log[0]})
  b = states.appendMessage(b, append(b, b_log))

  var msg = get(a, a_log)

  a = states.gotMessage(a, msg)
    t.deepEqual(a.ready, a_log[1])

  data = a.ready
  a = states.read(a)
  b = states.receiveMessage(b, data)

  t.deepEqual(b.effect, {action: 'append', value: msg})
    console.log(a)
    postAssert(a);
    console.log(b)
    postAssert(b)

  b = states.appendMessage(b, append(b, b_log))

    t.equal(b.local, msg.sequence)

  t.end()
})


