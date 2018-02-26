
exports.note = function (seq, rx) {
  return seq === -1 ? -1 : rx ? seq || 0 : ~(seq || -1)
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


