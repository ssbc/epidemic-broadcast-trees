
exports.note = function (seq, rx) {
  return seq === -1 ? -1 : seq === -2 ? -2 : seq << 1 | !rx
}

exports.getSequence = function getSequence(seq) {
  //if is fork, -2, if is other negative (or invalid) -1, else seq >> 1
  return seq === -2 ? -2 : (!Number.isInteger(seq) || seq === -1) ? -1 : seq >> 1
}

exports.getReplicate = function getReplicate(seq) {
  return (seq || 0) > -1
}

exports.getReceive = function getReceive (seq) {
  return (seq || 0) > -1 && !(seq & 1)
}

exports.isNotReplicate = function (seq) {
  return seq === -1
}
exports.isForked = function (seq) {
  return seq === -2
}






