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

tape('initialize, send each other notes, in sync',  function (t) {

  var states = {alice: S.init(10)}
  //total should be zero here because we do not expect
  //to send anything until unknown goes to zero.
  t.deepEqual(progress(states), {
    start: 0, current: 0, target: 2
  })
  states.alice = S.read(states.alice)
  t.deepEqual(progress(states), {
    start: 0, current: 1, target: 2
  })

  states.alice = S.receiveNote(states.alice, 10)
  t.deepEqual(progress(states), {
    start: 0, current: 2, target: 2
  })

  t.end()
})


tape('initialize, send each other notes',  function (t) {

  var states = {alice: S.init(10)}
  console.log(states)
  //total should be zero here because we do not expect
  //to send anything until unknown goes to zero.
  states.alice = S.read(states.alice)
  states.alice = S.receiveNote(states.alice, 9)
  console.log(states.alice)
  t.deepEqual(progress(states), {
    start: 9, current: 2+9, target: 2+10
  })

  states.alice = S.read(S.gotMessage(states.alice, {
    sequence: 10, author: 'alice', content: 'foo'
  }))

  t.deepEqual(progress(states), {
    start: 9, current: 2+9+1, target: 2+10
  })

  t.end()
})

tape('initialize, send each other notes, remote is ahead',  function (t) {

  var states = {alice: S.init(10)}
  console.log(states)
  //total should be zero here because we do not expect
  //to send anything until unknown goes to zero.
  states.alice = S.read(states.alice)
  states.alice = S.receiveNote(states.alice, 14)
  console.log(states.alice)
  t.deepEqual(progress(states), {
    start: 10, current: 2+10, target: 2+14
  })

  var msg = {
    sequence: 11, author: 'alice', content: 'foo'
  }
  states.alice = S.receiveMessage(states.alice, msg)
  states.alice = S.appendMessage(states.alice, msg)

  console.log(states)
  t.deepEqual(progress(states), {
    start: 10, current: 2+10+1, target: 2+14
  })

  t.end()
})


tape('initialize, send each other notes, remote refuses',  function (t) {

  var states = {alice: S.init(10)}
  console.log(states)
  //total should be zero here because we do not expect
  //to send anything until unknown goes to zero.
  states.alice = S.read(states.alice)
  states.alice = S.receiveNote(states.alice, -1)
  console.log(states.alice)
  t.deepEqual(progress(states), {
    start: 0, current: 2, target: 2
  })


  t.end()
})


//hmm, should this still wait for the remote note even though
//we said we were not interested in this at all?
tape('initialize, send each other notes, local refuses',  function (t) {

  var states = {alice: S.init(-1)}
  console.log(states)
  //total should be zero here because we do not expect
  //to send anything until unknown goes to zero.
  states.alice = S.read(states.alice)
  states.alice = S.receiveNote(states.alice, -1)
  console.log(states.alice)
  t.deepEqual(progress(states), {
    start: 0, current: 2, target: 2
  })


  t.end()
})


tape('initialize, send each other notes, behind, but does\'t want data ',  function (t) {

  var states = {alice: S.init(10)}
  console.log(states)
  //total should be zero here because we do not expect
  //to send anything until unknown goes to zero.
  states.alice = S.read(states.alice)
  states.alice = S.receiveNote(states.alice, -9)
  console.log(states.alice)
  t.deepEqual(progress(states), {
    start: 0, current: 2, target: 2
  })

  t.end()
})

