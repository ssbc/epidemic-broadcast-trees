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

    if(seq > note.seq) {
      //XXX if we support sync notes, then +- is not enough, because there are 3 types.
      //ha, bitshift right two bits and use those.

      t.deepEqual(state.effect, {action: 'get', value: {id: note.id, seq: note.seq + 1}}, 'retrive next message to send')
    }
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

  t.equal(state.received, Math.max(state.received, Math.abs(note.seq)), 'requested seq is kept')
}


tape('receiveNote, with random seqs and signs', function (t) {

  var local = {alice: 5}

  for(var i = 0; i < 100; i++) {

    var state = {
      local: local, sending: Math.random()<0.5, receiving: Math.random()<0.5,
      received: 4,
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

/*
the message we were about to send them
the message we just received
our max sequence
ready, message, seq

if ready is null, easy
  if message.sequence < seq: tell them to stop.
  if message.sequene == seq + 1,:correct, do nothing.
  if message.sequence > seq + 1: error. abort.

if ready is a message.
  if message.sequence < seq: drop ready, tell them to stop, (get should happen after read?)
  if message.sequence == seq + 1 && ready.sequence === seq
    update received, clear ready (because they already have it)
---

  if message.sequence < seq: tell them to stop.
  if message.sequene == seq + 1 {
    //if the sent the correct message, there is nothing you can tell them. just shut up.
    ready = null
  }
  if message.sequence > seq + 1: error. abort.


ASSUMES: that in READ, the {action: get, value: next} will happen.
*/

function post_receiveMessage (_state, state, message) {
  var t = this

  t.equal(state.received, Math.max(_state.received, message.sequence), 'received updated')

  var seq = _state.local[message.author]
  //if we receive a message we already know obut
  if(message.sequence <= seq) {
    if(_state.receiving) { //exit receive mode, if not already
      t.notOk(state.receiving, 'old message disables receive mode')
      t.deepEqual(state.ready, {id: message.author, seq: - _state.local[message.author]}, 'old message triggers request to exit receive')
      //AHA! what if you are sending, and have something ready and waiting
      //and you receive an old message - should you throw away that send? or send both?
      //or can they see that you are closer and stop sending?

      //if the ready is not the latest message we know:
      //  drop the ready, sending the note, then after the read is processed
      //  trigger another get for the next message.

      //if the ready is the same sequence as we'd send, just send it instead.
    }
    else //else do not change if not receiving
      t.equal(_state.receiving, state.receiving)
  }
  else if(message.sequence === seq + 1) {
    //this is the expected next message.
    t.deepEqual(state.effect, {action: 'append', value: message})
    //if we where gonna send them something, there is now nothing useful to say.
    t.notOk(state.ready)
    //XXX ACK (except maybe to ack this message, but only if we are now in sync with them)
  }
  else if(message.sequence > seq + 1) {
    //this is an error
    t.ok(state.error, 'error state due to future message')
  }
}

tape('receiveMessage, random', function (t) {

  //if a received message is already known
  //exit receive mode.
  for(var i = 0; i < 20; i++) {
    var state = {
      received: 3,
      receiving: Math.random()>0.5,
      sending: Math.random()>0.5,
      local: {alice: 5}
    }

    var _state = JSON.parse(JSON.stringify(state))
    var message = {author: 'alice', sequence:  2 + ~~(Math.random()*3), content: 'hello'}

    state = states.receiveMessage(state, message)

    post_receiveMessage.call(t, _state, state, message)

  }

  t.end()
})









