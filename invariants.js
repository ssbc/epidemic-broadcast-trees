var u = require('./util')

module.exports = function (cState) {
  if(u.isMessage(cState.nodeState.ready)) {
    if(cState.nodeState.ready.sequence < cState.nodeState.remote.req)
      throw new Error('about to send older than requested message')
    if(cState.nodeState.remote.seq != null && cState.nodeState.ready.sequence <= cState.nodeState.remote.seq)
      throw new Error('about to send an older message than already sent')
    if(cState.nodeState.ready.sequence > Math.max(cState.nodeState.remote.seq, cState.nodeState.remote.req) + 1)
      throw new Error('about to send a newer message than expected')
  }
}




