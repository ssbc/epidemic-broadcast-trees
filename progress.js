//Question: can I use req to reliably track how many
//messages we are expecting to receive?

//Math.max(null, null) is zero, but we want null
function max (a, b) {
  return a == null ? b : b == null ? a : Math.max(a, b)
}

function process(data, state) {
  var local = state.local
  var remote = state.remote
  var _seq = remote.req == -1 ? -1 : max(remote.seq, remote.req)
  var seq = local.req == -1 ? -1 : max(local.seq, local.req)

  //don't count this feed, because we do not expect
  //to exchange anything.
  //this should only happen when there are many connections.
  if(!local.tx && seq > _seq) return data

  //req represents what they _know_ we have because
  //we have either mentioned it in a note or sent it.

  if(seq == null) {
    //we havn't decided if we want this feed yet
    data.unknown ++
  } else if(seq === -1) {
    //we have decided we do not want this feed. don't count it.
  } else {
    if(_seq == null) {
      data.unknown ++
    } else if(_seq === -1) {
      //they have told us they do not want it.
      //this means we do not expect to send anything.
      //so don't count this feed.
    } else {
      data.feeds ++

      if(seq == _seq)
        data.sync ++

      data.total += Math.max(
        seq - remote.req,
        _seq - (local.req || local.seq)
      )
      if(seq > _seq && local.tx)
        data.send += seq - _seq
      else if(seq < _seq && remote.tx)
        data.recv += _seq - seq
    }
  }

  return data
}

module.exports = function (states) {
  var data = {
    sync: 0, feeds: 0,
    recv: 0, send: 0, total: 0,
    unknown: 0,
  }

  for(var k in states)
    //Only count this as an out of sync feed if we either can send
    //to it or receive from it.
    data = process(data, states[k])

  return data
}





