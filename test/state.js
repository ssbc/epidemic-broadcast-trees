var states = require('../state')
var tape = require('tape')
var u = require('../util')

function clone (obj) {
  return JSON.parse(JSON.stringify(obj))
}

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

    var _state = clone(state)
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

    var _state = clone(state)
    var message = {author: 'alice', sequence:  2 + ~~(Math.random()*3), content: 'hello'}

    state = states.receiveMessage(state, message)

    post_receiveMessage.call(t, _state, state, message)

  }

  t.end()
})

/*
  appendMessage is called when a message in this feed has been added to the local database.
  it can be triggered because it was created locally, or received from another peer.

  if we are in sending mode
    if it's the next message they need, {
      //there could be an unsent note
      make it ready
    }
  else
    make a _have_ note about it

//    if there isn't something else ready
    if we are in sending mode, make it ready

    if you where about to 

  if(we where about to send the initial request)
    make sure it is up to date.

  else if you are in sending mode
    XXX if we havn't sent an initial request, then send something?
    if it's the next message needed, send it.
    else
      null
  else
    if it's greater than the message we know they have,
      send a -note
    else
      null
*/

function post_appendMessage(_state, state, message) {
  var t = this
  //sending and receieving state should not change

  t.equal(_state.sending,   state.sending)
  t.equal(_state.receiving, state.receiving)
  t.equal(_state.sent,      state.sent)
  t.equal(_state.received,  state.received)

  if(state.received == null)
    t.notOk(u.isMessage(state.ready), 'if we havn\'t heard what they got, we must not send anything')

  //if ready was not set, it can only become set to the message.
  //but not always, because the remote might not be up to this.
  if(!_state.ready && state.sending)
    if(state.ready) {
      t.deepEqual(state.ready, message)
    }
  if(state.sending && state.sent + 1 == message.sequence && state.received < message.sequence) {
      t.deepEqual(state.ready, message)
  }
  else if(!state.sending && state.received < message.sequence)
    t.deepEqual(state.ready, {id: message.author, seq: -message.sequence}, 'send ack')

  if(state.received > message.sequence && state.sending) {
    if(u.isNote(_state.ready) && _state.ready.seq < 0)
      t.equal(state.ready, null, 'if they are still ahead, then don\'t tell them not to send')
    else if(state.ready) {
      t.deepEqual(state.ready, {id: message.author, seq: message.sequence}, 'if we where going to ask for this feed, update to latest')
    }
  }
  //if we where asking for this feed, and it hasn't been sent
  //we actually need to send that, but update the request.
  if(u.isNote(state.ready)) {
    t.equal(Math.abs(state.ready.seq), message.sequence, 'if we are sending a note, make sure it is up to date')

    if(_state.ready.seq > 0)
      t.equal(_state.ready.seq, message.sequence)
    else
      t.equal(_state.ready.seq, -message.sequence)
  }
  //hang on - what situations cause this?
  //maybe it's the initial request on a new connection, we gotta send that.
  //BUT if it's because we receive a note for the previous message
  //then send this one.
  //but if they are ahead of this message. send nothing.

  

}

tape('appendMessage', function (t) {

  var local = {alice: 5}

  for(var i = 0; i < 100; i++) {

    var state = {
      local: local,
      received: 3 + ~~(Math.random()*5),
      sent: 1 + ~~(Math.random()*4),
      sending: Math.random() < 0.5,
      receiving: Math.random() < 0.5,
      ready: Math.random() < 0.5 ? {id: 'alice', seq: Math.random() < 0.5 ? -4 : 4} : null
      //under what situations would a request be sent?
    }

    var message = {author: 'alice', sequence:  5, content: 'hello'}
    var _state = clone(state)
    var state = states.appendMessage(state, message)

    post_appendMessage.call(t, _state, state, message)

  }

  t.end()
})

tape('appendMessage in initial state', function (t) {
  var state = {
    local: {alice: 1},
    sent: null, received: null,
    sending: null, receiving: null,
    ready: {id: 'alice', seq: 1}
  }
  var message = {author: 'alice', sequence: 1, content: 'hi there'}

  var _state = clone(state)
  state = states.appendMessage(state, message)

  post_appendMessage.call(t, _state, state, message)
  t.end()
})


tape('retriveMessage', function (t) {
  //so simple testing isn't interesting.
  //if the state is "sending" and the retrived message is next
  //then send it.
  t.end()
})

function post_read (_state, state) {
  if(!_state.ready) return _state //nothing.

  var id = u.isNote(_state.ready) ? _state.ready.id : _state.ready.author
  var seq = u.isNote(_state.ready) ? Math.abs(_state.ready.seq) : _state.ready.sequence

  t.equal(state.sent, seq)
  t.equal(state.ready, null)

  //retrive the next item, if we have something.
  if(state.sending && state.sent < state.local[id])
    state.effect = {action: 'get', value: {id: id, seq: state.sent + 1}}

}

tape('read', function (t) {
  return t.end()
  //assume ready is already taken and sent by the glue layer.
  post_read.call(t, _state, state)

  //if there is another message ready to send, send it.
  //notes are never triggered from here. so in other places
  //that change from sending a note to a message should only
  //do that if the notes are now redundant.
  t.end()
})



