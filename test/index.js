var test = require('tape')

var events = require('../rewrite')

function isObject(o) {
  return o && 'object' === typeof o
}

function isFunction (f) {
  return 'function' === typeof f
}

function is (t, actual, expected, path) {
  if(isFunction(expected))
    expected.call(actual, path.concat(k))
  else t.equal(expected, actual, 'expected '+path.join('.')+' to equal:'+actual)
}

function has (t, actual, expected, path) {
  path = path || []

  if(!(isObject(actual))) return is(t, actual, expected, path)

  if(!isObject(expected))
    return t.fail('expected object at path:'+path.join('.'))

  for(var k in expected)
    has(t, actual[k], expected[k], path.concat(k))
}

test('initialize, connect to new peer', function (t) {

  var state = events.initialize()

  state = events.connect(state, {id: 'alice'})
  console.log(state)
  state = events.peerClock(state, {id: 'alice', value: {}})
  console.log(state)

  has(t, state, {
    peers: {
      alice: { clock: {}, msgs: [], notes: null, replicating: {} },
    }
  })

  state = events.clock(state, {})

  state = events.follow(state, {id: 'alice', value: true})

  t.deepEqual(state.follows, {alice: true})

  has(t, state.peers.alice, {
    clock: {},
    notes: { alice: 0 },
    replicating: {alice: {rx: true}}
  }, ['state', 'peers', 'alice'])

  console.log(state)

  //lets say we send the note

  state = events.notes(state, {id: 'alice', value: {alice: 2}})
  has(t, state, {
    clock: {},
    follows: {alice: true},
    peers: {
      alice: {
        clock: {alice: 2},
        replicating: {
          alice: {
            rx: true, tx: true
          }
        }
      }
    }
  })

  var msg = {author: 'alice', sequence: 1, content: {}}
  state = events.receive(state, {id: 'alice', value:msg})

  has(t, state, {
    peers: {
      alice: {
        clock: {alice: 2},
        replicating: {
          alice: {
            rx: true, tx: true
          }
        }
      }
    },
    receive: [msg],
  })

  var msg = state.receive.shift()

  state = events.append(state, msg)

  console.log(state)

  has(t, state, {
    clock: {alice: 1}
  })

  var msg2 = {author: 'alice', sequence: 2, content: {}}
  state = events.receive(state, {id: 'alice', value:msg2})
  state = events.append(state, state.receive.shift())

  has(t, state, {
    clock: {alice: 2}
  })

  var msg3 = {author: 'alice', sequence: 3, content: {}}
  state = events.receive(state, {id: 'alice', value:msg3})
  state = events.append(state, state.receive.shift())

  has(t, state, {
    clock: {alice: 3}
  })

  t.end()

})

test('connect to two peers, append message one send, one note', function (t) {

  var state = {
    clock: { alice: 1 },
    peers: {
      bob: {
        clock: { alice: 1 },
        msgs: [], retrive: [],
        replicating: {
          alice: {
            rx: true, tx: true, sent: 1, retrive: false
          }
        }
      },
      charles: {
        clock: {alice: 1},
        msgs: [], retrive: [],
        replicating: {
          alice: {
            rx: false, tx: false, sent: 1, retrive: false
          }
        }
      }
    }
  }

  var msg = {author: 'alice', sequence: 2, content: {}}
  state = events.append(state, msg)

  has(t, state, {
    clock: { alice: 2 },
    peers: {
      bob: {
        clock: { alice: 1 },
        msgs: [msg],
        retrive: [],
        replicating: {
          alice: {
            rx: true, tx: true, sent: 2, retrive: false
          }
        }
      },
      charles: {
        clock: { alice: 1 },
        notes: { alice: -3 },
        retrive: [],
        replicating: {
          alice: {
            rx: false, tx: false, sent: 1
          }
        }
      }
    }
  })

  t.end()

})




