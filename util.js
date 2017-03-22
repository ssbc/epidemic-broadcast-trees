//this should be replaced with a heap,
//but i'll look for a good heap implementation later
//this should be enough for now.
exports.sort = function (queue) {
  return queue.sort(function (a, b) {
    if(!a.value && !b.value) return 0
    if(a.value && !b.value) return -1
    else if(b.value && !a.value) return 1
    else return a.value.timestamp - b.value.timestamp
    return 0
  })
}

exports.isMessage = function (msg) {
  return msg && Number.isInteger(msg.sequence) && 'string' === typeof msg.author && msg.content
}

exports.isNote = function (note) {
  return note && Number.isInteger(note.seq) && 'string' == typeof note.author && !msg.content
}
