var createSimulator = require('./simulator')
var options = require('./options')
var progress = require('../progress')
var test = require('tape')

function count (output) {
  return output.reduce(function (a, b) {
    return b.msg ? a : a + 1
  }, 0)
}

function flatten (output) {
  return output.reduce(function (a, b) {
    if(b.msg) return a
    for(var k in b.value)
      a[b.from][k] = options.getSequence(b.value[k])
    return a
  }, {alice: {}, bob: {}})
}

test('loose local state', function (t) {
  var tick = createSimulator(0, true, options)

  var network = {}
  var alice = network['alice'] = tick.createPeer('alice')
  var bob = network['bob'] = tick.createPeer('bob')

  alice.init({})
  bob.init({})

  alice.append({author: 'alice', sequence: 1, content: {}})
  alice.append({author: 'alice', sequence: 2, content: {}})
  alice.append({author: 'alice', sequence: 3, content: {}})
  bob.append({author: 'bob', sequence: 1, content: {}})

  alice.follow('bob')
  alice.follow('alice')
  bob.follow('alice')
  bob.follow('bob')

  alice.connect(bob)

  console.log("bob is", bob)
  
  while(tick(network)) ;

  alice.disconnect(bob)

  //should have set up peer.replicatings to tx/rx alice
  t.deepEqual(flatten(tick.output), {alice: {alice: 3, bob: 0}, bob: {alice: 0, bob: 1}})
  t.equal(count(tick.output), 2)

  t.deepEqual(bob.store, alice.store)

  function isComplete (peer, name) {
    var prog = progress(peer.state)
    t.equal(prog.current, prog.target, name +' is complete')
  }

  isComplete(alice, 'alice')
  isComplete(bob, 'bob')

  // bob gets a brick in his head and forgets everything
  bob = network['bob'] = tick.createPeer('bob')
  bob.init({})
  t.deepEqual(bob.store, {})
  
  alice.connect(bob)

  while(tick(network)) ;

  t.deepEqual(bob.store, alice.store)
  
  isComplete(alice, 'alice')
  isComplete(bob, 'bob')
  
  t.end()
})
