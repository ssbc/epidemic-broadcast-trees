# epidemic-broadcast-trees

This module is based on plumtree Epidemic Broadcast Trees paper,
but adapted to also replicate logs, and optimized to achive a minimal
overhead (the cost of the protocol is linear with the number of messages to be sent)

It's a algorithm that combines the robustness of a flooding epidemic gossip broadcast,
with the efficiency of a tree model. It's intended for implementing realtime protocols
(such as chat, scuttlebutt, also radio/video) over networks with random topology -
or networks where otherwise peers may be unable to all connect to each other or to a central hub.

Although the primary motivation for this module is to use it in secure scuttlebutt,
it's intended to be decoupled sufficiently to use for other applications.

## example

implement a simple in memory log replicator.

``` js
var clocks = {}
var logs = {}

function append (msg, cb) {
  var log = logs[msg.author] = logs[msg.author] || []
  //check that this is the next expected message.
  if(msg.sequence != log.length)
    cb(new Error('out of order, found:'+msg.sequence+', expected:'+log.length))
  else {
    log.push(msg)
    ebt.onAppend(msg)
    cb()
  }
}

var ebt = EBT({
  //NOTE: in this example, we are using readable strings for clarity
  //but ideally you'd use cryptographic ids, like public keys.
  id: 'alice',
  getClock: function (id, cb) {
    //load the peer clock for id.
    cb(null, clocks[id] || {})
  },
  setClock: function (id, clock) {
    //set clock doesn't have take a cb, but it's okay to be async.
    clocks[id] = clock
  },
  getAt: function (pair, cb) {
    //load a message particular message, by id:sequence
    if(!logs[pair.id] || !logs[pair.id][pair.sequence])
      cb(new Error('not found'))
    else
      cb(null, logs[pair.id][pair.sequence])
  },
  append: append
})

ebt.append({
  author: 'alice', sequence: 1, content: {}
}, function () {})

//must explicitly say we are replicating which peers.
ebt.request('alice', true)
ebt.request('bob', true)

//create a stream and pipe it to another instance
var stream = ebt.createStream('bob')
stream.pipe(remote_stream).pipe(stream)
```

> note about push-stream: push-stream is only new, so you'll probably
  need to convert this to a pull-stream to connect stream to a network
  io stream and serialization

``` js
var pushToPull = require('push-stream-to-pull-stream')
var stream = pushToPull(ebt.createStream(remote_id))
pull(stream, remote_pull_stream, stream)
```


## API

### EBT(opts) => ebt

where opts provides the necessary things to connect ebt
to your system.

```
opts = {
  id: string,
  timeout: 3000, //default,
  getClock: function (id, cb),
  setClock: function (id, clock),
  getAt: function ({id:string, sequence:number}, cb),
  append: function (msg, cb),
  isFeed: function (id),
}
```

Create a new EBT instance. `id` is a unique identifier of the current peer.
In [secure-scuttlebutt](https://scuttlebutt.nz) this is a ed25519 public key.

`getClock(id, cb)` and `setClock(id, clock)` save a peer's clock object.
This is used to save bandwidth when reconnecting to a peer again.

`getAt({id, sequence}, cb)` retrives a message in a feed and an sequence.
messages must have `{author, sequence, content}` fields.

`append(msg, cb)` append a particular message to the log.

`timeout` is used to decide when to switch a feed to another peer.
This is essential to detecting when a peer may have stalled.

`isFeed(id)` is a validation function that returns true if `id`
is a valid feed identifier. If not, it is ignored'

### ebt.onAppend (msg)

When a message is appended to the database, tell ebt about it.
this must be called whenever a message is successfully appended to the database.

### ebt.request(id, follow)

Tell ebt to replicate a particular feed. `id` is a feed id, and `follow` is a `boolean`.
If `follow` is `false`, but previously was called with true, ebt will stop replicating
that feed.

#### `ebt.progress()`

returns an object which represents the current replication progress.

an example object output looks like this, all values are integers >= 0.

``` js
{
  start: S, //where we where at when we started
  current: C, //operations done
  total: T //operations expected
}
```

this follows a common pattern I've used across ssbc modules for representing progress,
used for example here: `https://github.com/ssbc/scuttlebot/blob/master/lib/progress.js`


#### ebt.state

The state of the replication is available at `ebt.state`.
Read only access is okay, but updating should only be done via ebt methods.

```
{
  id: <id>, //our id,
  clock: {<id>: <seq>}, //our local clock,
  follows: {<id>: <boolean>}, //who we replicate, true if we replicate.
  blocks: {<id>: {<id>: <boolean>}}, //who blocks who, true if they are blocked.
  peers: { //currently connected peers
    <id>: {
      clock: {<id>: <seq|-1>}, //feeds that we KNOW the peer is up to. -1 if they do not replicate that feed.
      msgs: [<msg>], //queue of messages waiting to be sent.
      retrive: [<seq>], //sequence numbers of messages to look up in our database.
      notes: null || {<id>: <encoded_seq>}, //notes object (encoded vector clock to be sent)
      replicating: { //feeds being replicated to peer.
        <id>: {
          rx: <boolean>,
          tx: <boolean>,
          sent: <seq|-1|null>, //sequence number of message we sent.
          requested: <seq|-1|null> //sequence number we asked for.
        }
      }
    }
  },
  receive: [<msg>] //queue of incoming messages
}
```

notes: `<X>` is a value type.
`<id>` is a "feed id" value that `opts.isFeed(id) === true`.
(note, this doesn't actually need to be an ssb feed id, this module can be used for other things too)
`<seq>` is an positive integer or zero. -1 is used to represent if the are explicitly not replicating that feed.
`<msg>` is an object with at least `{author: <id>, sequence: <seq>, ...}` properties.

## comparison to plumtree

I had an idea for a gossip protocol that avoided retransmitting messages by putting
unneeded connections into standby mode (which can be brought back into service when necessary)
and then was pleasantly surprised to discover it was not a new idea, but had already been described
in a paper - and there is an implementation of that paper in erlang here: https://github.com/helium/plumtree

There are some small differences, mainly because I want to send messages in order, which makes
it easy to represent what messages have not been seen using just a incrementing sequence number per feed.

But plumbtree is solely a broadcast protocol, not an eventually consistent replication protocol.
Since we are replicating _logs_ it's also necessary to send a handshake to request the feeds
from the right points. If you are replicating thousands of feeds the size of the handshake is
significant, so we introduce an algorithm for "request skipping" that avoids sending unnecessary
requests, and saves a lot of bandwidth compared to just requesting all feeds each connection.

## todo

* handle models where it's okay to have gaps in a log (as with classic [insecure scuttlebutt](https://github.com/dominictarr/scuttlebutt)

## License

MIT

