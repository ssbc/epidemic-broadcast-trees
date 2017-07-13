function isWanted (n) {
  return n != null && n >= 0
}

function toSend (data, remote, local) {
  if(isWanted(remote.req) && isWanted(local.req)) {
    if(local.tx && remote.req < local.req) {
      data.start += remote.req
      data.target += Math.max(local.req, local.seq)
      data.current += (remote.seq || remote.req)
    }
  }
  return data
}

function reduce (data, state) {

  //we have sent request
  data.target += 1
  if(state.local.req != null)
    data.current += 1

  // we have received request
  data.target += 1
  if(state.remote.req != null)
    data.current += 1

  data = toSend(data, state.remote, state.local)
  data = toSend(data, state.local, state.remote)

//  if(state.local.req != null && state.remote.req != null) {
//    if(state.remote.req < state.local.req) {
//    }
//    else if(state.local.req < state.remote.req) {
//      data.start += state.remote.req
//      data.target += state.local.seq
//      data.current +=(state.remote.seq || state.remote.req)
//    }
//
//  }

  return data
}

module.exports = function (states) {
  var data = {start:0, current: 0, target: 0}
  for(var k in states)
    data = reduce(data, states[k])
  return data
}


