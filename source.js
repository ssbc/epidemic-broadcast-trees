

/*
  OUR_SEQ, THEIR_SEQ, THEM_RECV, US_RECV

  onRecieveValidMessage: //after we have processed the message.
    if(OUR_SEQ > THEIR_SEQ && THEM_RECV)
      send(msg)
    else if(OUR_SEQ < THEIR_SEQ && US_RECV)
      send({id: msg.author, seq: msg.sequence}) //OPTIONAL, don't have to do this every time
  onReceiveMessage:
    if(OUR_SEQ > msg.sequence)
      send({id: msg.author, seq: - OUR_SEQ}) //tell them to stop sending.
                                             //else, validate the message and continue.
  onRecieveNote:
    if(note.seq < 0 && THEM_RECV) {
      THEM_RECV = false //they have asked us to stop sending this feed to them.
    }
    if(Math.abs(note.seq) > OUR_SEQ) {
      US_RECV = true
      send({id: note.id, seq: OUR_SEQ})
    }

  onBeginReplication:
    for(var id in feeds)
      send({id: id, seq: feed[id].seq})

  //okay I feel satisfied that is the correct logic
  //but how do I make this FSM pull?
*/

//local and remote are observables, containing maps {id:sequence}
//if sequence is negative on remote then it means "up to here" but do not send.

exports = module.exports = function (local, remote) {

  var queues = []

  //updated whenever the remote sends a vector clock.
  remote(function () {
    //iterate the queue, check if everything is still wanted.
    // 1. if remote says id:-n then stop sending id (remove from queue)
  })

  local(function () {
    // 2. if we are receiving from remote, then we move ahead, we must send a {id: -seq} message
          to tell them not to send to us.


  })

  function read (abort, cb) {
    //find the most recent queue and send it.
    ;(function next () {
    exports.sort(queue)
    if(!queue.length) //nothing ready.
      ready.once(next, false)
    else if(remote[queue.value.author] < 0)
    //take the oldest available item.
    })()
  }
}

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










