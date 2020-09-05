var createSimulator = require('./simulator')
var options = require('./options')

var test = require('tape')

test('partial replication', function (t) {
  var tick = createSimulator(0, true, options)

  var network = {}
  var alice = network['alice'] = tick.createPeer('alice')
  var bob = network['bob'] = tick.createPeer('bob')
  var charlie = network['charlie'] = tick.createPeer('charlie')

  alice.init({})
  bob.init({})
  charlie.init({})

  alice.append({author: 'alice', sequence: 1, content: {}})
  alice.append({author: 'alice', sequence: 2, content: {}})
  alice.append({author: 'alice', sequence: 3, content: {}})

  //alice.store['alice'] = alice.store['alice'].slice(1)
  
  alice.follow('alice')
  bob.follow('alice')

  bob.follow('charlie')
  charlie.follow('bob')
  charlie.follow('alice')

  alice.connect(bob)

  while(tick(network)) ;

  // alice sends her whole feed to bob
  t.deepEqual(bob.store, alice.store)

  alice.disconnect(bob)

  // lets assume that instead bob had done a partial replication with alice
  bob.store['alice'] = bob.store['alice'].slice(1)

  bob.connect(charlie)
  
  while(tick(network)) ;

  // charlie is not able to get alices feed from bob
  t.deepEqual({}, charlie.store)

  // FIXME
  // unless charlie disconnects from bob, charlie will not be able to
  // get data from alice
  charlie.disconnect(bob)
  
  charlie.connect(alice)
  
  while(tick(network)) ;

  // charlie should now have alices feed
  t.deepEqual(alice.store, charlie.store)
  
  t.end()
})
