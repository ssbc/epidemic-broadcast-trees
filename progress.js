
module.exports = function (state) {
  var prog = {start:0, current: 0, target: 0}
  for(var peer in state.peers)
    for(var feed in state.peers[peer].replicating) {
      var rep = state.peers[peer].replicating[feed]
      //progress for sending initial note
      prog.target ++
      if(rep.sent != null) prog.current ++
      prog.target ++
      var peerClock = state.peers[peer].clock
      if(peerClock) {
        prog.current ++

        var seq1 = Math.max(peerClock[feed] || 0, rep.sent), seq2 = state.clock[feed] || 0
        console.log(seq1, seq2)
        prog.target += Math.max(seq1, seq2) - Math.min(seq1, seq2)

      }
    }
  return prog
}















