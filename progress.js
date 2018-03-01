
/*
  better progress algorithm:

  count number of feeds we expect to send to each peer.
  sum of the difference between what they have asked, and what we have sent.

  same for receive, but have to remember what we asked for.

*/

module.exports = function (state) {
  var prog = {start:0, current: 0, target: 0}
  for(var peer_id in state.peers)
    var peer = state.peers[peer_id]

//    prog.target ++
//    if(peer.replicating) prog.current ++

    for(var feed_id in peer.replicating) {
      var rep = peer.replicating[feed_id]
      //progress for sending initial note
      prog.target ++
      if(rep.sent != null) prog.current ++

      prog.target ++
      if(rep.requested != null) prog.current ++

      var seq = peer.clock[feed_id]
      var lseq = state.clock[feed_id] || 0
      if(rep.rx && rep.requested != null && rep.requested > -1 && lseq < seq) {
        prog.current += lseq - rep.requested
        prog.target += seq - rep.requested
          //Math.max(seq - rep.requested, lseq - rep.requested)
      }
      if(rep.tx && seq > -1 && seq < lseq) {
        prog.current += rep.sent - seq
        prog.target += lseq - seq
      }
    }
  return prog
}

