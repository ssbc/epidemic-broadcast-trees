
var createSimulator = require('../simulator')
var test = require('tape')

function count (output) {
  return output.reduce(function (a, b) {
    return b.msg ? a : a + 1
  }, 0)
}

function pos (n) {
  return n < -1 ? ~n : n
}

function flatten (output) {
  return output.reduce(function (a, b) {
    if(b.msg) return a
    for(var k in b.value)
      a[b.from][k] = pos(b.value[k])
    return a
  }, {alice: {}, bob: {}})
}

function createTest (seed, log) {
  test('simple test with seed:'+seed, function (t) {
    var tick = createSimulator(seed, log)


    var network = {}
    var alice = network['alice'] = tick.createPeer('alice')
    var bob = network['bob'] = tick.createPeer('bob')

    alice.init({})
    bob.init({})

    alice.append({author: 'alice', sequence: 1, content: {}})
    alice.append({author: 'alice', sequence: 2, content: {}})
    alice.append({author: 'alice', sequence: 3, content: {}})
    bob.append({author: 'bob', sequence: 1, content: {}})

    alice.follow('alice')
    alice.follow('bob')
    bob.follow('alice')
    bob.follow('bob')

    alice.connect(bob)

    while(tick(network)) ;

    alice.disconnect(bob)
    //should have set up peer.replicatings to tx/rx alice
    t.deepEqual(flatten(tick.output), {alice: {alice: 3, bob: 0}, bob: {alice: 0, bob: 1}})
    t.equal(count(tick.output), 2)
    bob.append({author: 'bob', sequence: 2, content: {}})

    console.log('1', tick.output)
    tick.output.splice(0, tick.output.length)
    while(tick(network)) ;

    console.log('2', tick.output)
    tick.output.splice(0, tick.output.length)
    alice.connect(bob)
    while(tick(network)) ;

    console.log('3', tick.output)
    t.deepEqual(flatten(tick.output), {alice: {alice: 3, bob: 1}, bob: {alice: 3, bob: 2}})
    t.equal(count(tick.output), 3)
    tick.output.splice(0, tick.output.length)

    alice.disconnect(bob)
    alice.connect(bob)
    while(tick(network)) ;

    t.deepEqual(bob.store, alice.store)
    console.log('4', tick.output)
    tick.output.splice(0, tick.output.length)
    t.end()
  })
}

var seed = process.argv[2]
if(isNaN(seed))
  for(var i = 0; i < 100; i++) createTest(i)
else createTest(+seed, true)



