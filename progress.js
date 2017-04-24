//Question: can I use req to reliably track how many
//messages we are expecting to receive?

//Math.max(null, null) is zero, but we want null
function max (a, b) {
  return a == null ? b : b == null ? a : Math.max(a, b)
}

function process(data, state) {
  var local = state.local
  var remote = state.remote
  var _seq = max(remote.seq, remote.req)
  var seq = max(local.seq, local.req)

  //don't count this feed, because we do not expect
  //to exchange anything.
  //this should only happen when there are many connections.
  if(!local.tx && seq > _seq) return data

  data.feeds ++


  //req represents what they _know_ we have because
  //we have either mentioned it in a note or sent it.
  data.total = Math.max(
    seq - remote.req,
    _seq - (local.req || local.seq)
  )

  if(local.seq == _seq)
    data.sync ++
  else if(local.seq == null || _seq == null)
    data.unknown ++
  else if(local.seq > _seq && local.tx) {
    data.send += local.seq - _seq
  } else if(local.seq < _seq && remote.tx) {
    data.recv += _seq - local.seq
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








