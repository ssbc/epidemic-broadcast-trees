# epidemic-broadcast-trees

This is an implementation of the plumtree Epidemic Broadcast Trees paper.
It's a algorithm that combines the robustness of a flooding epidemic gossip broadcast,
with the efficiency of a tree model. It's intended for implementing realtime protocols
(such as chat, scuttlebutt, also radio/video) over networks with random topology -
or networks where otherwise peers may be unable to all connect to each other or to a central hub.

Although the primary motivation for this module is to use it in secure scuttlebutt,
it's intended to be decoupled sufficiently to use for other applications.

## example


#### `stream.progress()`

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


## comparison to plumtree

I had an idea for a gossip protocol that avoided retransmitting messages by putting
unneeded connections into standby mode (which can be brought back into service when necessary)
and then was pleasantly surprised to discover it was not a new idea, but had already been described
in a paper - and there is an implementation of that paper in erlang here: https://github.com/helium/plumtree

There are some small differences, mainly because I want to send messages in order, which makes
it easy to represent what messages have not been seen using just a incrementing sequence number per feed.

## todo

* call a user function to decide whether we want to replicate a given feed (say, for blocking bad pers)
* handle models where it's okay to have gaps in a log (as with classic [insecure scuttlebutt](https://github.com/dominictarr/scuttlebutt)

## License

MIT








