/* eslint-disable camelcase */
/*
  better progress algorithm:

  count number of feeds we expect to send to each peer.
  sum of the difference between what they have asked, and what we have sent.

  same for receive, but have to remember what we asked for.
*/

module.exports = function (state) {
  const prog = { start: 0, current: 0, target: 0 }
  for (const peer_id in state.peers) {
    const peer = state.peers[peer_id]

    for (const feed_id in peer.replicating) {
      const rep = peer.replicating[feed_id]
      // progress for sending initial note
      prog.target++
      if (rep.sent != null) prog.current++

      prog.target++
      if (rep.requested != null) prog.current++

      const seq = peer.clock[feed_id]
      const lseq = state.clock[feed_id] || 0

      if (rep.rx && rep.requested != null && rep.requested > -1 && lseq < seq) {
        prog.current += lseq - rep.requested
        prog.target += seq - rep.requested
      }

      if (rep.tx && seq > -1 && seq < lseq) {
        prog.current += rep.sent - seq
        prog.target += lseq - seq
      }
    }
  }

  return prog
}
