var u = require('./util')
var isMessage = u.isMessage
var isNote = u.isNote

//okay just pretending to be purely functional
//(but if you have good functional disipline, you can mutate)
function clone (state) { return state }

function isInitRx (state) {
  return state.remote.req != null && state.remote.tx != null
}

function canSend(state) {
  return isInitRx(state) &&
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
    local: {seq: local, req: null, tx: null},
      //the highest sequence we have sent to them
      //the sequence they gave us (which they thus definitely have)
      //whether they are transmitting
    remote: {seq: null, req: null, tx: null},
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
  state.ready =  null
  if(isMessage(_ready))
    state.remote.seq = _ready.sequence
  else {
    state.local.req = Math.abs(_ready)
    state.remote.tx = _ready >= 0
  }

  if(canSend(state))
    state.effect = {action: 'get', value: Math.max(state.remote.seq, state.remote.req) + 1}
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
    state.local.tx &&
    state.remote.req < msg.sequence &&
//    (msg.sequence === (state.remote.seq === null ? state.remote.req : state.remote.seq) + 1)
    msg.sequence === (Math.max(state.remote.seq, state.remote.req) + 1)
  )
}


exports.receiveMessage = function (state, msg) {
  if(!isMessage(msg)) throw new Error('expected a Message!')
  var _state = clone(state)
  _state.remote.req = Math.max(state.remote.req || 0, msg.sequence)
  _state.remote.seq = msg.sequence

  if(state.remote.tx == null)
    throw new Error('we received a message, when we where waiting for remote to send initial request')

  var seq = state.local.seq
  if(isOldMessage(state, msg)) {
    //we already know this, please shut up!
    if(state.remote.tx) {
      //let read move us out of tx mode,
      //incase this note is overridden.
      //_state.remote.tx = false
      _state.ready = -seq
    }
  }
  else if(isNextRxMessage(state, msg)) {
    //since we now know they are ahead, stop transmitting to them
    if(state.local.tx === true)
      _state.local.tx = false
    if(state.ready != null)
      _state.ready = null
    _state.effect = {action: 'append', value: msg}
  }
  else
    _state.error = true

  return _state
}

exports.receiveNote = function (state, note) {
  var _state = clone(state)
  var seq = state.local.seq
  var requested = note >= 0
  var _seq = Math.abs(note)

  if(!isInitRx(state)) {
    _state.remote.tx = _seq >= seq
    //if they have asked us not to send, don't.
    _state.local.tx = _seq <= seq && requested
  }
  else {
    _state.local.tx = requested
  }
  _state.remote.req = _seq

  if(isMessage(state.ready) && _seq > state.ready.sequence)
      state.ready = null

  //if we thought they where transmitting
  //but they sent us a note, then obviously they weren't
  //so turn off remote.tx and request it again.

  if(seq < _seq/* && state.remote.tx == null*/) {
    //if(state.remote.tx !== null)
    console.log(_state, seq, _seq, note)
    if(requested && state.remote.tx == false)
      _state.remote.tx = false
    _state.ready = seq
  }
//  else

//  if(seq < _seq) {
//    //_state.remote.tx = false
//    _state.ready = seq
//  }
//  if(seq < _seq) {
//    _state.remote.tx = false
//    _state.ready = seq
//  }
//
  console.log((seq > _seq), requested, seq, _seq)
  if((seq > _seq) && requested) {
    _state.effect = {action: 'get', value: _seq + 1}
  }

  return _state
}

//we have either written a new message ourselves,
//or received a message (and validated it) from another peer.
exports.appendMessage = function (state, msg) {
  //if this is the msg they need next, make
  var _state = clone(state)

  _state.local.seq = msg.sequence

  if(state.local.tx) {
    if(isNextTxMessage(state, msg))
      _state.ready = msg
    else if(isNote(state.ready)) { //this should only happen when it is the initial request
      //if it's back to even, we don't need to send a message, but if we are not
      //then the message has meaning.
      _state.ready = msg.sequence === Math.max(state.remote.seq, state.remote.req) ? null : msg.sequence
    }
    else if(!isMessage(_state.ready))
      _state.ready = null
  }
  else if(!state.local.tx) {
    //unless we know they are up to this, send a note
    if(msg.sequence >= state.remote.req)
      _state.ready = state.remote.tx ? msg.sequence : -msg.sequence //SEND NOTE
    else if(isNote(state.ready) && state.ready > 0)
      state.ready = message.sequence //UPDATE NOTE
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
  else {
    //do nothing, it's an old message, so send no notes.
    //we should only get here is we triggered a `get` effect
    //but then changed state before it completed.
    ;
  }
  if(!state.local.tx) //do nothing
  //if we are not in sending state, just stop.
  //otherwise, the next retrival will be triggered by READ
  ;
  return _state
}











