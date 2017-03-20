# epidemic-broadcast-trees

## Broadcast
```
vars = have_clock, request_clock

READY:
  request: (id, seq) {
    if(have_clock[id] >= seq)
      get(id, seq) //GETTING => got
  },
GETTING:
  got: (msg) {
    if(request_clock[msg.key] + 1 == msg.value.sequence) {
      request_clock[msg.key] ++
      send(msg)
      if(request_clock[msg.key] < have_clock[id]) get(id, msg.value.sequence + 1) //GETTING -> got
    }
    //shift to real time
  }
  live: (msg) { // received a message in realtime, send if that is what they want.
    if(request_clock[msg.key] + 1 == msg.value.sequence) {
      request_clock[msg.key] ++
      send(msg)
    }
  }
```

READ:
  if(new connection)
    reply: wants

SET_REMOTE_HAS:
  for(id in local)
    if(local[id] > remote[id])
      attach_queue(id, local[id])

LIVE_LOCAL:
  if(remote[msg.author] < msg.sequence)
    q

## License

MIT













