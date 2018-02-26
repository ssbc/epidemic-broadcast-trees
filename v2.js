
exports.setNotes = function setNotes (peer, feed, seq, rx) {
  peer.notes = peer.notes || {}
  peer.notes[feed] = seq === -1 ? -1 : rx ? seq || 0 : ~(seq || -1)
  if(peer.replicating[feed])
    //note: we don't have a way to represent seq=0 but don't rx, so always rx if zero.
    peer.replicating[feed].rx = (seq || 0) === 0 || !!rx
}

exports.getSequence = function getSequence(seq) {
  return (
    !Number.isInteger(seq) ? -1 
  : seq > -1 ? seq
  : seq < -1 ? ~seq
  : -1
  )
}

exports.getReplicate = function getReplicate(seq) {
  return seq !== -1
}

exports.getReceive = function getReceive (seq) {
  return seq > -1
}

