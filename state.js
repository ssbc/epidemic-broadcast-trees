var u = require('./util')
var isMessage = u.isMessage
var isNote = u.isNote

//okay just pretending to be purely functional
//(but if you have good functional disipline, you can mutate)
function clone (state) { return state }

//actually, want to be able to initialize this in receive mode or not.
exports.init = function (local, seq) {
  return {
    local: local,
    sending: seq > 0,
    receiving: false,
    sent: Math.abs(seq), received: Math.abs(seq),
    ready: null,
    effect: []
  }
}

//this is not a reduce, and it has side effects.
exports.read = function (state) {
  if(!state.ready) return [null, state]
  var _ready = state.ready
  state.ready =  null
  if(isMessage(_ready))
    state.sent = _ready.sequence
  return [_ready, state]
}

exports.receiveMessage = function (state, msg) {
  var _state = clone(state)
  _state.received = Math.max(state.received || 0, msg.sequence)

  var seq = state.local[msg.author]
  if(msg.sequence <= seq) {
    //we already know this, please shut up!
    if(state.receiving) {
      _state.receiving = false
      _state.ready = {id: msg.author, seq: - seq}
    }
  }
  else if(msg.sequence == seq + 1) {
    //they said what we where going to
    if(state.ready) _state.ready = null
    _state.effect = {action: 'append', value: msg}
  }
  else
    _state.error = true

  return _state
}

exports.receiveNote = function (state, note) {
  var _state = clone(state)
  var seq = state.local[note.id]
  var requested = note.seq > 0
  var _seq = Math.abs(note.seq)

  _state.received = _seq

  if(!requested)
    _state.sending = false
  else
    _state.sending = true
  if(isMessage(state.ready) && _seq > state.ready.sequence)
      state.ready = null
  if(seq < _seq && !state.receiving) {
    _state.receiving = true
    _state.ready = {id: note.id, seq: seq}
  }
  if(seq > _seq && requested) {
    _state.effect = {action: 'get', value: {id: note.id, seq: _seq + 1}}
  }

  return _state
}

//we have either written a new message ourselves,
//or received a message (and validated it) from another peer.
exports.appendMessage = function (state, msg) {
  //if this is the msg they need next, make
  var _state = clone(state)
  if(state.sending) {
    if(state.sent + 1 === msg.sequence && state.received < msg.sequence)
      _state.ready = msg
    else if(isNote(state.ready)) //this should only happen when it is the initial request
      _state.ready = {id: msg.author, seq: msg.sequence}
    else if(!isMessage(_state.ready))
      _state.ready = null
  }
  else if(!state.sending) {
    //unless we know they are up to this, send a note
    if(msg.sequence > state.received)
      _state.ready = {id: msg.author, seq: -msg.sequence}
    else if(isNote(state.ready) && state.ready.seq > 0)
      state.ready.seq = message.sequence
    else
      state.ready = null
  }
  return state
}

//have retrived an requested message
exports.retriveMessage = function (state, msg) {
  var _state = clone(state)
  if(state.sending && state.received + 1 == msg.sequence)
    _state.ready = msg
  //if we are not in sending state, just stop.
  //otherwise, the next retrival will be triggered by READ
  return _state
}









