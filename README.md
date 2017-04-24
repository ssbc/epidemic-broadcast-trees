# epidemic-broadcast-trees

This is an implementation of the plumtree Epidemic Broadcast Trees paper.
It's a algorithm that combines the robustness of a flooding epidemic gossip broadcast,
with the efficiency of a tree model. It's intended for implementing realtime protocols
(such as chat, scuttlebutt, also radio/video) over networks with random topology -
or networks where otherwise peers may be unable to all connect to each other or to a central hub.

Although the primary motivation for this module is to use it in secure scuttlebutt,
it's intended to be decoupled sufficiently to use for other applications.

## example

A simple example is a chatroom - here we just store user messages in arrays.

to create an instance of this protocol for your application, you need to pass in
a `vectorClock` object, and `get` and `append` functions.
(Note, that the functions need to be async - this is so that we can use it for bigger
things like replicating databases)

The `vectorClock` is a map of the ids of all the nodes in the system, with the sequence
numbers they are currently up to.

`get` takes a id, a sequence, and a callback.
`append` takes a message object.
The message object should have `{author: id, sequence: integer, content: ...}`

Where content can be any string or serializable js value.

The returned stream will also have an `onAppend` method, this should be called when ever
messages are appended to the structure, whether they where created locally or added with `append`.
the `onAppend` should be called immediately before calling append's callback.

In this example, we'll use [observables](https://github.com/dominictarr/obv) to call
`onAppend`  this means we can connect each peer to multiple others and it will work great!

``` js
var pull = require('pull-stream')
var createEbtStream = require('epidemic-broadcast-trees')
var Obv = require('obv')
//create a datamodel for a reliable chat room.

function createChatModel (id, log) {
  //in this example, logs can be a map of arrays,
  var logs = {}
  logs[id] = log || []
  var onAppend = Obv()
  return {
    logs: logs,
    append: function append (msg) {
      (logs[msg.author] = logs[msg.author] || []).push(msg)
      onAppend.set(msg)
    },
    onAppend: onAppend
  }
}

function createStream(chat) {

  //so the vector clock can be
  var vectorClock = {}
  for(var k in chat.logs)
    vectorClock[k] = chat.logs[k].length

  //observables are like an event emitter but with a stored value
  //and only one value per instance (instead of potentially many named events)


  var stream = createEbtStream(
    vectorClock,
    //pass a get(id, seq, cb)
    function (id, seq, cb) {
      if(!chat.logs[id] || !chat.logs[id][seq])
        return cb(new Error('not found'))
      cb(null, chat.logs[id][seq])
    },
    //pass append(msg, cb)
    function (msg, cb) {
      chat.append(msg)
      cb()
    }
  )

  chat.onAppend(stream.onAppend)

  return stream
}

var alice = createChatModel('alice', [])
var bob = createChatModel('bob')

var as = createStream(alice)
var bs = createStream(bob)

pull(as, bs, as)

//have bob get ready to receive something
bob.onAppend(function (msg) {
  console.log('msg at bob:', msg)
})

//have alice send a message to bob
alice.append({author: 'alice', sequence: 1, content: 'hello bob!'})

```

## api

``` js
var createStream = require('epidemic-broadcast-trees')

var stream = createStream(seqs, get, append, onChange, callback)
```
### createStream(seqs, get, append, onChange, callback) => stream

* `seqs` is an object that maps `id` to `sequence`.
this represents who you want to follow initially.
`{<id>:<sequence>,..}`
* `get(id, seq, cb)` is an async function that gets the message by a feed at a particular sequence number.
* `append(msg, callback)` an async function that appends a single message to the log.
* `onChange` a function that is called each time the state changes. This is useful to call `stream.progress()`
* `callback(err)` is called when the replication connection ends.

### stream

A duplex pull-stream returned by the `createStream` method, it
also has a few extra methods.

#### `stream.onAppend(msg)`
sync function that _must_ be called when a message is added to the local database.

#### `stream.progress()`

returns an object which represents the current replication progress.

an example object output looks like this, all values are integers >= 0.

``` js
{
  feeds: N, //number of feeds being replicated.
  sync: N, //number of feeds that are fully synchronised.
  send: N, //number of messages that you need to send.
  recv: N, //number of messages that you expect to receive.
  total: N, //number of messages that need to be sent or received to become in sync.
  unknown: N, //number of feeds which are at unknown progress, because one party has not given a known sequence from this feed yet.
}
```

to make a progress bar that move smoothly across and represents
the state of the current session, you can use

``` js
var prog = stream.progress()
//changes from 0 to 1 when fully replicated.
console.log(1 - ((prog.send+prog.recv) / prog.total))
```

## comparison to plumtree

I had an idea for a gossip protocol that avoided retransmitting messages by putting
unneeded connections into standby mode (which can be brought back into service when necessary)
and then was pleasantly surprised to discover it was not a new idea, but had already been described
in a paper - and there is an implementation of that paper in erlang here: https://github.com/helium/plumtree

There are some small differences, mainly because I want to send messages in order, which makes
it easy to represent what messages have not been seen using just a incrementing sequence number per feed.

## todo

* progress signals about how replicated we are (whether we are in sync or not, etc)
* call a user function to decide whether we want to replicate a given feed (say, for blocking bad pers)
* handle models where it's okay to have gaps in a log (as with classic [insecure scuttlebutt](https://github.com/dominictarr/scuttlebutt)

## License

MIT


