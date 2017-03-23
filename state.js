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
  _state.received = msg.sequence

  if(!state.receiving) {
    //we should not have received a message if we are in sending state!
    _state.error = true
  }
  else if(state.receiving) {
    if(state.local[msg.author] > msg.sequence) {//we already know this msg
      _state.ready = {id: msg.author, seq: -1*state.local[msg.author]}
      _state.receiving = false
    }
    else if(state.local[msg.author] + 1 == msg.sequence)
      _state.effect = {action: 'append', value: msg}
      ; //SIDE EFFECT: ready to validate
    else
      ; //ignore
  }

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

//  _state.received = Math.max(Math.abs(note.seq), _state.has || 0)
//  if(!state.sending)
//    if(note.seq > 0) {
//      _state.sending = true
//    }
//  if(state.sending) {
//    if(note.seq < 0) {
//      _state.sending = false
//      _state.ready = null
//    }
//
//    //they know about a message we don't yet, go into receiving mode
//    if(Math.abs(note.seq) > state.local[note.id] && !state.receiving) {
//      _state.receiving = true
//      _state.sending = false
//      //ready for next request.
//      _state.ready = {id: note.id, seq: state.local[note.id]}
//    }
//
//    //we where about to send a message, but they asked for an older one (weird)
//    if(state.ready && state.ready.sequence <= note.seq) {
//      _state.ready = null
//      _state.effect = {action: 'get', value: note}
//      //SIDE EFFECT: retrive next message
//    }
//  }
//  else if(state.recieving) {
//    //generally shouldn't happen but
//    //could if we have just switched to receiving but they didn't get the message yet
//  }
//  else if(!state.receiving) {
//    if(state.local[note.id] < Math.abs(note.seq)) {
//      _state.receiving = true
//      _state.ready = {id: note.id, seq: state.local[note.id]} //request this feed from our current value.
//    }
//    else if(note.seq > 0) {
//      _state.sending = true
//      if(state.local[note.id] > note.seq) {
//        if(!isMessage(state.ready) || state.ready.sequence !== note.sequence) {
//          _state.ready = null
//          _state.effect = {action: 'get', value: {id: note.id, seq: note.seq+1}}
//        }
//      }
//    }
//  }
//
  return _state
}

//we have either written a new message ourselves,
//or received a message (and validated it) from another peer.
exports.appendMessage = function (state, msg) {
  //if this is the msg they need next, make
  var _state = clone(state)
  if(state.sending && state.sent + 1 === msg.sequence)
    _state.ready = msg
  else if(!state.sending)
    //how about some way to delay sending notes, for bandwidth?
    //and to slow down upwards replication if you are datacapped.
    _state.ready = {id: msg.author, seq: msg.sequence * -1}
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





