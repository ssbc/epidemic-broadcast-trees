
var tick = require('./simulator')()
var events = require('../../rewrite').events
var network = {}
var alice = network['alice'] = tick.createPeer('alice')
var bob = network['bob'] = tick.createPeer('bob')

alice.init({})
bob.init({})

alice.append({author: 'alice', sequence: 1, content: {}})
alice.append({author: 'alice', sequence: 2, content: {}})
alice.append({author: 'alice', sequence: 3, content: {}})

console.log('ALICE', JSON.stringify(alice, null, 2))

alice.follow('alice')
bob.follow('alice')

alice.connect(bob)

alice.state = events.peerClock(alice.state, {id: 'bob', value: {}})
bob.state = events.peerClock(bob.state, {id: 'alice', value:{}})


while(tick(network)) ;
//console.log(tick(network))
//console.log(tick(network))
//console.log(tick(network))
//console.log(tick(network))
//console.log(tick(network))
//console.log(tick(network))
//console.log(tick(network))
//console.log(tick(network))

//should have set up peer.replicatings to tx/rx alice
console.log('BOB', JSON.stringify(bob, null, 2))
console.log('ALICE', JSON.stringify(alice, null, 2))


//console.log(JSON.stringify(bob, null, 2))
//



