var states = require('../state')
var tape = require('tape')
var u = require('../util')

tape('receiveMessage 1', function (t) {

  var local = {alice: 2}

  var msg = {sequence: 3, author: 'alice', content: 'blah'}

  var _state = states.receiveMessage({
    receiving: true, local: local,
  }, msg)

  t.deepEqual(_state, { receiving: true, local: local, received: 3, effect: {action: 'append', value: msg} })

  t.end()
})

//we can be ahead, behind, or in sync with the remote
//we can also be sending, receiving, idle (neither), or both.
//but if both, normally one will ask to stop receiving soon.

tape('receiveNote, remote requests for sequence we have', function (t) {

  var local = {alice: 2}

  var state = {
    local: local, sending: false
  }

  var _state = states.receiveNote(state, {id: 'alice', seq: 2})

  t.ok(_state.sending)
  t.equal(_state.received, 2)
  t.notOk(_state.effect) //no effect, because we don't have a message for them yet!
  t.end()

})

tape('receiveNote, remote requests for sequence we are past', function (t) {

  var local = {alice: 2}

  var state = {
    local: local, sending: false
  }

  var _state = states.receiveNote(state, {id: 'alice', seq: 1})

  t.ok(_state.sending)
  t.equal(_state.received, 1)
  t.deepEqual(_state.effect, {action: 'get', value: {id: 'alice', seq: 2}})

  t.end()

})

tape('receiveNote, remote requests unrequests message we are sending', function (t) {
  var local = {alice: 2}

  var state = {
    local: local, sending: true, receiving: false
  }

  var _state = states.receiveNote(state, {id: 'alice', seq: -2})

  t.notOk(_state.sending)
  t.equal(_state.received, 2)
  t.notOk(_state.effect)

  t.end()

})

tape('receiveNote, remote requests unrequests message when we are not sending', function (t) {
  var local = {alice: 2}

  var state = {
    local: local, sending: false, receiving: false
  }

  var _state = states.receiveNote(state, {id: 'alice', seq: -2})

  t.notOk(_state.sending)
  t.equal(_state.received, 2)
  t.notOk(_state.effect)

  t.end()

})

//things that should be true, after receiving a note.
function post_receiveNote (_state, state, note) {
  var t = this
  t.notOk(_state.effect)
  //if negative turn off send
  var seq = state.local[note.id]
  
  if(note.seq < 0) {
    t.equal(state.sending, false, 'disable sending mode')
  }
  if(note.seq > 0) {
    //if positive, turn on send
    t.equal(state.sending, true, 'enable sending')
    //if behind us, get ready to send
    //we should never see an effect set on _state.

    if(seq > note.seq)
      t.deepEqual(state.effect, {action: 'get', value: {id: note.id, seq: note.seq + 1}}, 'retrive next message to send')
  }

  //we realize they are ahead. if we had something ready, it's out of date now.
  if(seq < Math.abs(note.seq)) {
    //if we WERE in sending mode, and hand something ready,
    //but then receive a note that says they are ahead,
    //then we should not send the thing we where going to send!
    //either enter receiving mode, or unset the ready item.
    if(!_state.receiving) {
      t.ok(state.receiving, 'enter receiving state') //enter receiving state
      t.deepEqual(state.ready, {id: note.id, seq: seq}, 'send note to receive')
    }
    //what happens here, if something was ALREADY ready?
    else if(u.isMessage(_state.ready))
      t.equal(state.ready, null)
  }
  else if(_state.ready)
    t.deepEqual(state.ready, _state.ready)

  t.equal(state.received, Math.abs(note.seq), 'requested seq is kept')
}


tape('receiveNote, with random seqs and signs', function (t) {

  var local = {alice: 5}

  var state = {
    local: local, sending: false, receiving: false
  }


  for(var i = 0; i < 100; i++) {

    var state = {
      local: local, sending: Math.random()<0.5, receiving: Math.random()<0.5,
      ready: Math.random() < 0.2 ? {author: 'alice', sequence: 5, content: 'hello'} : null
    }

    var _state = JSON.parse(JSON.stringify(state))
    var note = {id: 'alice', seq: ~~(Math.random()*20) - 10}
    state = states.receiveNote(state, note)
    post_receiveNote.call(t, _state, state, note)
  }

  //What if something was ALREADY in ready, and a note is received?
  //it could be a message we where about to send
  //or a note,

  t.end()
})



