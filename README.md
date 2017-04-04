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
var createEbtStream = require('epidemic-broadcast-trees')
var Obv = require('obv')
//create a datamodel for a reliable chat room.
function createChatModel () {
  //in this example, logs can be a map of arrays,
  var logs = {}
  var onAppend = Obv()
  return {
    logs: logs,
    append: function append (msg) {
      logs[msg.author].push(msg)
      onAppend.set(msg)
    },
    onAppend: onAppend()
  }
}

function createStream(chat) {

  //so the vector clock can be
  var vectorClock = {}
  for(var k in logs)
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
      if(msg.sequence !== logs[msg.author].length + 1)
        return cb(new Error('incorrect position'))
      chat.append(msg)
      cb()
    }
  )

  onAppend(stream.onAppend)

  return stream
}
```

## todo

* progress signals about how replicated we are (whether we are in sync or not, etc)
* call a user function to decide whether we want to replicate a given feed (say, for blocking bad pers)
* handle models where it's okay to have gaps in a log (as with classic [insecure scuttlebutt](https://github.com/dominictarr/scuttlebutt)

## License

MIT

