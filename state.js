'use strict'
var u = require('./util')
var isMessage = u.isMessage
var isNote = u.isNote

//okay just pretending to be purely functional
//(but if you have good functional disipline, you can mutate)
function clone (state) { return state }

function isInitRx (state) {
  return state.remote.req == null || state.local.req == null
}

function canSend(state) {
  return !isInitRx(state) &&
    state.local.seq > Math.max(state.remote.seq, state.remote.req)  && state.local.tx
}

//actually, want to be able to initialize this in receive mode or not.
exports.init = function (local) {
  if(!Number.isInteger(local))
    throw new Error('local must be integer')
  //idea for better structure
  return {
    //state of local,
      //highest sequence we have
      //the sequence we asked for (set on initial)
      //whether we are transmitting
    local: {seq: local, req: null, tx: true},
      //the highest sequence we have sent to them
      //the sequence they gave us (which they thus definitely have)
      //whether they are transmitting
    remote: {seq: null, req: null, tx: true},
    //the next item to send. (orderly queue)
    ready: local,
    //the next thing to do to database (disorderly queue)
    effect: null
  }
}

//this is not a reduce, and it has side effects.
exports.read = function (state) {
  if(state.ready == null) return state
  var _ready = state.ready
  state.ready = null
  if(isMessage(_ready)) {
    if(state.remote.seq != null && Math.max(state.remote.seq, state.remote.req) +1 !== _ready.sequence) {
      throw new Error('out of order!')
    }
    state.remote.seq = _ready.sequence
    state.local.req = Math.max(state.local.req, _ready.sequence)
  } else {
    state.local.req = Math.abs(_ready)
    state.remote.tx = _ready >= 0
  }
  if(canSend(state)) {
    state.effect = Math.max(state.remote.seq, state.remote.req) + 1
  }

  return state
}

function isOldMessage(state, msg) {
  return (state.local.seq >= msg.sequence)
}

function isNextRxMessage(state, msg) {
  return state.local.seq + 1 == msg.sequence
}

function isNextTxMessage (state, msg) {
  return (
    !isInitRx(state) &&
    state.remote.req < msg.sequence &&
    msg.sequence === Math.max(state.remote.seq, state.remote.req) + 1
  )
}


exports.receiveMessage = function (state, msg) {
  if(!isMessage(msg)) throw new Error('expected a Message!')
  var _state = clone(state)

  _state.remote.req = Math.max(state.remote.req || 0, msg.sequence)
  //not the same^
  _state.remote.seq = Math.max(state.remote.seq || 0, msg.sequence)

  if(state.remote.tx == null)
    throw new Error('we received a message, when we where waiting for remote to send initial request')

  var seq = state.local.seq
  if(isMessage(state.ready)) {
    if(state.ready.sequence <= msg.sequence)
      state.ready = null
  }
  if(isOldMessage(state, msg)) {
    //we already know this, please shut up!
    //let read move us out of tx mode,
    if(state.remote.tx)
      _state.ready = -seq
  }
  else if(isNextRxMessage(state, msg)) {
    //since we now know they are ahead, stop transmitting to them
    if(state.ready != null)
      _state.ready = null
    _state.effect = msg
    if(state.remote.tx == false)
      state.ready = state.local.seq
  }
  else {
    //this means something went really wrong
    _state.error = true
  }
  return _state
}

exports.receiveNote = function (state, note) {
  if(!isNote(note)) throw new Error('expected note!')
  var _state = clone(state)
  var seq = state.local.seq
  var requested = note >= 0
  var _seq = Math.max(Math.abs(note), state.remote.seq)

  _state.local.tx = requested
  _state.remote.req = Math.max(_seq, _state.remote.req)

  if(state.local.req == null) return _state

  if(isMessage(state.ready) && _seq >= state.ready.sequence)
      state.ready = null

  //if they sent a note which is ahead of us, and we did not previously send something.

  if(seq < _seq && state.remote.tx == false) {
    state.ready = state.local.seq
  }
  else
  if((seq > _seq) && requested)
    _state.effect = _seq + 1

  return _state
}

//we have either written a new message ourselves,
//or received a message (and validated it) from another peer.
exports.appendMessage = function (state, msg) {
  if(!isMessage(msg)) throw new Error('appendMessage expects a message!')
  //if this is the msg they need next, make
  var _state = clone(state)
  _state.local.seq = msg.sequence

  if(state.local.tx) {
    if(isNextTxMessage(state, msg)) {
      _state.ready = msg
    }
    else if(isNote(state.ready)) { //this should only happen when it is the initial request
      //if we are transmitting, why would we be sending a note?
      //if it's back to even, we don't need to send a message, but if we are not
      //then the message has meaning.
      //if(state.remote.tx)

      if(state.local.req != null) {
        _state.ready = null
        if(_state.local.seq > Math.max(state.remote.seq, state.remote.req))
          _state.effect = Math.max(state.remote.seq, state.remote.req) + 1
      }
    }
    else if(!isMessage(_state.ready)) {
      _state.ready = null

      if(state.local.seq > Math.max(state.remote.req,state.remote.seq))
        state.effect = Math.max(state.remote.req,state.remote.seq) + 1
    }
  }
  else if(!state.local.tx) {
    //unless we know they are up to this, send a note
    if(msg.sequence > state.remote.req) {
      _state.ready = state.remote.tx ? msg.sequence : -msg.sequence //SEND NOTE
    }
    else if(isNote(state.ready) && state.ready > 0)
      state.ready = msg.sequence //UPDATE NOTE
    else
      state.ready = null
  }
  return state
}

//have retrived an requested message
exports.gotMessage = function (state, msg) {
  if(!isMessage(msg)) throw new Error('expected message')
  var _state = clone(state)
  if (isNextTxMessage(state, msg)) {
    _state.ready = msg
  }
  //if it's not the next message
  //we must have changed state while retriving this message
  //anyway, just get on with things
  return _state
}


