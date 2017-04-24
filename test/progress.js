var tape = require('tape')
var progress = require('../progress')
var S = require('../state')

/*
  progress states

  received remote note, not yet ours *
  have our note, not yet theirs

  we are both at the same sequence (sync) 0
  we are ahead (send) -1
  they are ahead (recieve) 1

  * this might happen because we don't know about that feed yet.
    since currently, it just automatically replicates everything
    that is asked for.
*/

tape('unknown',  function (t) {

  var states = {alice: S.init(10)}
  t.deepEqual(progress(states), {
    unknown: 1,  sync: 0,
    send: 0, recv: 0, total: 10,
    feeds: 1
  })
  t.end()
})

tape('receive remote note, behind us', function (t) {
  //receive a message, now we know what we need to send

  var states = {alice: S.init(10)}
  states.alice = S.receiveNote(states.alice, 6)
  t.deepEqual(progress(states), {
    unknown: 0,  sync: 0,
    send: 4, recv: 0, total: 4,
    feeds: 1
  })

  t.end()
})

tape('receive remote note, ahead us', function (t) {
  //receive a message, now we know what we need to send

  var states = {alice: S.init(6)}
  states.alice = S.receiveNote(states.alice, 10)
  console.log(states)
  t.deepEqual(progress(states), {
    unknown: 0,  sync: 0,
    send: 0, recv: 4, total: 4,
    feeds: 1
  })

  t.end()
})

tape('receive remote note, equal to us', function (t) {
  //receive a message, now we know what we need to send

  var states = {alice: S.init(6)}
  states.alice = S.receiveNote(states.alice, 6)
  t.deepEqual(progress(states), {
    unknown: 0,  sync: 1,
    send: 0, recv: 0, total: 0,
    feeds: 1
  })

  t.end()
})

tape('send a message to peer behind us', function (t) {
  //receive a message, now we know what we need to send

  var states = {alice: S.init(10)}
  states.alice = S.receiveNote(states.alice, 4)
  states.alice = S.read(states.alice)
  t.deepEqual(progress(states), {
    unknown: 0,  sync: 0,
    send: 6, recv: 0, total: 6,
    feeds: 1
  })
  states.alice = S.gotMessage(
    states.alice,
    {author: 'alice', sequence: 5, content: 'hello'}
  )
  console.log(states)

  states.alice = S.read(states.alice)
  console.log(states)
  t.deepEqual(progress(states), {
    unknown: 0,  sync: 0,
    send: 5, recv: 0, total: 6,
    feeds: 1
  })
//XXX we can actually calculate an overall per message progress
//here, because we can compare the remote.req to our local.seq
//and remote.seq

  t.end()
})

function receiveAppend(state, msg) {
  state = S.receiveMessage(state, msg)
  return S.appendMessage(state, msg)
}

tape('receive a message from a peer ahead of us', function (t) {
  //receive a message, now we know what we need to send

  var states = {alice: S.init(4)}
  states.alice = S.receiveNote(states.alice, 8)
  states.alice = S.read(states.alice)
  t.deepEqual(progress(states), {
    unknown: 0,  sync: 0,
    send: 0, recv: 4, total: 4,
    feeds: 1
  })

  states.alice = receiveAppend(
    states.alice,
    {author: 'alice', sequence: 5, content: 'hello'}
  )

  t.deepEqual(progress(states), {
    unknown: 0,  sync: 0,
    send: 0, recv: 3, total: 4,
    feeds: 1
  })

  states.alice = receiveAppend(
    states.alice,
    {author: 'alice', sequence: 6, content: 'hello'}
  )
  states.alice = receiveAppend(
    states.alice,
    {author: 'alice', sequence: 7, content: 'hello'}
  )
  states.alice = receiveAppend(
    states.alice,
    {author: 'alice', sequence: 8, content: 'hello'}
  )
  console.log(states)
  t.deepEqual(progress(states), {
    unknown: 0,  sync: 1,
    send: 0, recv: 0, total: 4,
    feeds: 1
  })


//XXX we can actually calculate an overall per message progress
//here, because we can compare the remote.req to our local.seq
//and remote.seq

  t.end()
})


