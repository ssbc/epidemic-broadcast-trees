var createSimulator = require('./simulator')
var options = require('./options')
var progress = require('../progress')

var test = require('tape')

function validate (queue, msg) {
  var sum = queue.reduce(function (a, b) {
    return a + b.content.value
  }, 0)
  if(sum != msg.content.sum) throw new Error('invalid sum:'+msg.content.sum+', expected:'+sum)
}

function createTest (seed, log) {
  test('simple test with seed:'+seed, function (t) {
    var tick = createSimulator(seed, log, options)

    var network = {}
    var alice = network['alice'] = tick.createPeer('alice', validate)
    var bob = network['bob'] = tick.createPeer('bob', validate)
  //  var charles = network['charles'] = tick.createPeer('charles', validate)

    alice.init({})
    bob.init({})
//    charles.init({})

    alice.append({author: 'alice', sequence: 1, content: {sum:  0, value: 1}})
    alice.append({author: 'alice', sequence: 2, content: {sum:  1, value: 2}})
    alice.append({author: 'alice', sequence: 3, content: {sum:  3, value: 3}})
    alice.append({author: 'alice', sequence: 4, content: {sum:  6, value: 4}})
    alice.append({author: 'alice', sequence: 5, content: {sum: 10, value: 5}})
    alice.append({author: 'alice', sequence: 6, content: {sum: 15, value: 6}})
    alice.append({author: 'alice', sequence: 7, content: {sum: 21, value: 7}})

    bob.append({author: 'alice', sequence: 1, content: {sum: 0, value: 1}})
    //this message is forked.
    bob.append({author: 'alice', sequence: 2, content: {sum: 1, value: 3}})
//    bob.append({author: 'alice', sequence: 3, content: {sum: 4, value: 1}})

    alice.follow('alice')
    bob.follow('alice')
  //  charles.follow('alice')

    alice.connect(bob)
//    alice.connect(charles)

    while(tick(network)) ;

    //should have set up peer.replicatings to tx/rx alice

    t.deepEqual(bob.state.blocks, {alice: {alice: true}})

    var prog = progress(bob.state)
    t.equal(prog.current, prog.target)

//    t.equal(bob.state.peers.alice.replicating.alice.tx, false, 'bob is not transmitting forked alice with alice')
    t.equal(bob.state.peers.alice.replicating.alice.rx, false, 'bob is not receiving forked alice with alice')

    if(log)
      console.log(
        tick.output.map(function (e) {
          if(e.msg)
            return e.from+'>'+e.to+':'+e.value.sequence
          else
            return e.from+'>'+e.to+':'+JSON.stringify(e.value)
        }).join('\n')
      )

    t.end()
  })
}

var seed = process.argv[2]
if(isNaN(seed)) for(var i = 0; i < 100; i++) createTest(i)
else createTest(+seed, true)

