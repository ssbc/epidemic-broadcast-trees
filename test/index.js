var test = require('tape')

var events = require('../events')

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
  state = events.peerClock(state, {id: 'alice', value: {}})

  has(t, state, {
    peers: {
      alice: { clock: {}, msgs: [], notes: {}, replicating: {} },
    }
  })

  state = events.clock(state, {})

  state = events.follow(state, {id: 'alice', value: true})

  t.deepEqual(state.follows, {alice: true})
  console.log(state.peers.alice)

  has(t, state.peers.alice, {
    clock: {},
    notes: { alice: 0 },
    replicating: {alice: {rx: true}}
  }, ['state', 'peers', 'alice'])

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

test('reply to any clock they send, 1', function (t) {
  var state = {
    clock: { alice: 3, bob: 2, charles: 3 },
    follows: { alice: true, bob: true, charles: true, darlene: false },
    peers: {}
  }

  state = events.connect(state, {id: 'bob'})
  state = events.peerClock(state, {id: 'bob', value:{alice: 3, charles: 1}})
  t.deepEqual(state.peers.bob.notes, {bob: 2, charles: 3})

  state = events.notes(state, {id: 'bob', value: {alice: 3, darlene: 4}})

  //notes hasn't been sent, so this is merged with previous
  t.deepEqual(state.peers.bob.notes, {alice: ~3, bob: 2, charles: 3, darlene: -1})

  t.end()
})

test('reply to any clock they send, 2', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: { alice: true, bob: true},
    peers: {}
  }

  state = events.connect(state, {id: 'bob'})
  state = events.peerClock(state, {id: 'bob', value:{alice: 3, charles: 1}})
  t.deepEqual(state.peers.bob.notes, {bob: 2})

  state = events.notes(state, {id: 'bob', value: {alice: 3}})

  //notes hasn't been sent, so this is merged with previous
  t.deepEqual(state.peers.bob.notes, {alice: ~3, bob: 2})

  state = events.follow(state, {id: 'charles',value: true})
  t.deepEqual(state.peers.bob.notes, {alice: ~3, bob: 2, charles: 0})

  t.end()
})

test('append when not in TX mode', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: { alice: true, bob: true},
    peers: {}
  }
  state = events.connect(state, {id: 'bob'})
  state = events.peerClock(state, {id: 'bob', value:{alice: 3, charles: 1}})
  t.deepEqual(state.peers.bob.notes, {bob: 2})

  state = events.notes(state, {id: 'bob', value: {alice: ~3}})
  var rep = state.peers.bob.replicating.alice
  t.equal(rep.tx, false)
  t.equal(rep.sent, 3)

  console.log(state.peers.bob.replicating)

  state = events.append(state, {author: 'alice', sequence: 4, content: {}})
  t.deepEqual(state.peers.bob.notes, {bob: 2, alice: ~4})
  var rep = state.peers.bob.replicating.alice
  t.equal(rep.tx, false)
  t.equal(rep.sent, 3)

  state = events.notes(state, {id: 'bob', value: {alice: 3}})
  t.deepEqual(state.peers.bob.retrive, ['alice'])

  t.end()
})

test('note when not in RX mode', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: { alice: true, bob: true},
    peers: {
      bob: {
        clock: {alice: 3, bob: 2},
        retrive: [],
        msgs: [],
        notes: null,
        replicating: {
          alice: {
            tx:false, rx: false, sent: 3
          }
        }
      }
    }
  }

  state = events.notes(state, {id: 'bob', value: {alice: ~5}})
  var rep = state.peers.bob.replicating.alice
//  t.equal(rep.tx, true)
  t.equal(rep.rx, true)
  t.equal(rep.sent, 5)
  t.deepEqual(state.peers.bob.notes, {alice: 3})

  console.log(state.peers.bob.replicating)

//  state = events.append(state, {author: 'alice', sequence: 4, content: {}})
//  t.deepEqual(state.peers.bob.notes, {bob: 2, alice: ~4})
//  var rep = state.peers.bob.replicating.alice
//  t.equal(rep.tx, false)
//  t.equal(rep.sent, 3)
//
  t.end()

})

test('note when value is not integer', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: { alice: true, bob: true},
    peers: {}
  }

  state = events.connect(state, {id: 'bob'})
  state = events.peerClock(state, {id: 'bob', value:{}})

  t.deepEqual(state.peers.bob.clock, {})
  state = events.notes(state, {id: 'bob', value: {alice: true}})

  t.deepEqual(state.peers.bob.clock, {alice: -1})
  t.deepEqual(state.peers.bob.notes, {alice: 3, bob: 2})

  t.end()
})

test('test sends empty clock if nothing needed', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: { alice: true, bob: true},
    peers: {}
  }

  state = events.connect(state, {id: 'bob'})
  state = events.peerClock(state, {id: 'bob', value:{alice: 3, bob: 2}})

  t.deepEqual(state.peers.bob.clock, {alice: 3, bob: 2})
  t.deepEqual(state.peers.bob.notes, {})

  //receive empty clock
  state = events.notes(state, {id: 'bob', value: {}})
  t.deepEqual(state.peers.bob.replicating, {})

  t.end()
})


test('connects in sync then another message', function (t) {
  var state = {
    clock: { alice: 3, bob: 2},
    follows: { alice: true, bob: true},
    peers: {}
  }

  state = events.connect(state, {id: 'bob'})
  state = events.peerClock(state, {id: 'bob', value:{alice: 3, bob: 2}})

  t.deepEqual(state.peers.bob.clock, {alice: 3, bob: 2})
  t.deepEqual(state.peers.bob.notes, {})

  //receive empty clock
  state = events.notes(state, {id: 'bob', value: {}})
  t.deepEqual(state.peers.bob.replicating, {})

  state = events.append(state, {author: 'alice', sequence: 4, content: {}})
  t.deepEqual(state.peers.bob.notes, {alice: ~4})
  
  t.end()
})
