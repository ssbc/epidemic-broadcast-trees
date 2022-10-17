const test = require('tape')

function isObject (o) {
  return o && typeof o === 'object'
}

function isFunction (f) {
  return typeof f === 'function'
}

function is (t, actual, expected, path) {
  if (isFunction(expected)) { expected.call(actual) } else t.equal(expected, actual, 'expected ' + path.join('.') + ' to equal:' + actual)
}

function has (t, actual, expected, path) {
  path = path || []

  if (!(isObject(actual))) return is(t, actual, expected, path)

  if (!isObject(expected)) { return t.fail('expected object at path:' + path.join('.')) }

  for (const k in expected) { has(t, actual[k], expected[k], path.concat(k)) }
}

module.exports = function (events) {
  const note = events.note

  test('initialize, connect to new peer', function (t) {
    let state = events.initialize()

    state = events.connect(state, { id: 'alice', client: false })
    state = events.peerClock(state, { id: 'alice', value: {} })

    has(t, state, {
      peers: {
        alice: { clock: {}, msgs: [], notes: {}, replicating: {} }
      }
    })

    state = events.clock(state, {})

    state = events.follow(state, { id: 'alice', value: true })

    t.deepEqual(state.follows, { alice: true })
    console.log(state.peers.alice)

    has(t, state.peers.alice, {
      clock: {},
      notes: { alice: note(0, true) },
      replicating: { alice: { rx: true } }
    }, ['state', 'peers', 'alice'])

    // lets say we send the note

    state = events.notes(state, { id: 'alice', value: { alice: note(2, true) } })
    has(t, state, {
      clock: {},
      follows: { alice: true },
      peers: {
        alice: {
          clock: { alice: 2 },
          replicating: {
            alice: {
              rx: true, tx: true
            }
          }
        }
      }
    })

    const msg = { author: 'alice', sequence: 1, content: {} }
    state = events.receive(state, { id: 'alice', value: msg })

    has(t, state, {
      peers: {
        alice: {
          clock: { alice: 2 },
          replicating: {
            alice: {
              rx: true, tx: true
            }
          }
        }
      },
      receive: [{ id: 'alice', value: msg }]
    })

    const ev = state.receive.shift()

    state = events.append(state, ev.value)

    has(t, state, {
      clock: { alice: 1 }
    })

    const msg2 = { author: 'alice', sequence: 2, content: {} }
    state = events.receive(state, { id: 'alice', value: msg2 })
    state = events.append(state, state.receive.shift().value)

    has(t, state, {
      clock: { alice: 2 }
    })

    const msg3 = { author: 'alice', sequence: 3, content: {} }
    state = events.receive(state, { id: 'alice', value: msg3 })
    state = events.append(state, state.receive.shift().value)

    has(t, state, {
      clock: { alice: 3 }
    })

    t.end()
  })

  test('initialize, but append before peerClock loads', function (t) {
    let state = events.initialize()
    state = events.clock(state, { alice: 1, bob: 2 })

    state = events.connect(state, { id: 'alice', client: false })
    state = events.append(state, { author: 'bob', sequence: 3, content: {} })

    state = events.peerClock(state, { id: 'alice', value: {} })
    // TODO does this test anything?
    t.end()
  })

  test('connect to two peers, append message one send, one note', function (t) {
    let state = {
      clock: { alice: 1 },
      follows: { alice: true },
      blocks: {},
      peers: {
        bob: {
          clock: { alice: 1 },
          msgs: [],
          retrive: [],
          replicating: {
            alice: {
              rx: true, tx: true, sent: 1, retrive: false
            }
          }
        },
        charles: {
          clock: { alice: 1 },
          msgs: [],
          retrive: [],
          replicating: {
            alice: {
              rx: false, tx: false, sent: 1, retrive: false
            }
          }
        }
      }
    }

    const msg = { author: 'alice', sequence: 2, content: {} }
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
          notes: { alice: note(2, false) },
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

  test('replicate a hops=2 peer that my hops=1 friend still doesnt have', function (t) {
    let state = events.initialize()
    state = events.clock(state, {})

    state = events.connect(state, { id: 'alice', client: false })
    state = events.peerClock(state, { id: 'alice', value: { alice: 0, bob: 0 } })

    state = events.follow(state, { id: 'alice', value: true })
    state = events.follow(state, { id: 'bob', value: true })

    t.ok(state.peers.alice.replicating.bob)

    t.end()
  })

  test('replicate a hops=2 peer that my hops=1 friend still doesnt have (2)', function (t) {
    let state = events.initialize()
    state = events.clock(state, {})

    state = events.follow(state, { id: 'alice', value: true })
    state = events.follow(state, { id: 'bob', value: true })

    state = events.connect(state, { id: 'alice', client: false })
    state = events.peerClock(state, { id: 'alice', value: { alice: 0, bob: 0 } })

    t.ok(state.peers.alice.replicating.bob)

    t.end()
  })

  test('reply to any clock they send, 1', function (t) {
    let state = {
      clock: { alice: 3, bob: 2, charles: 3 },
      follows: { alice: true, bob: true, charles: true, darlene: false },
      blocks: {},
      peers: {}
    }

    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: 3, charles: 1 } })
    t.deepEqual(state.peers.bob.notes, { bob: note(2, true), charles: note(3, true) })

    state = events.notes(state, { id: 'bob', value: { alice: note(3, true), darlene: note(4, true) } })

    // notes hasn't been sent, so this is merged with previous
    t.deepEqual(state.peers.bob.notes, { alice: note(3, false), bob: note(2, true), charles: note(3, true), darlene: note(-1, true) })

    t.end()
  })

  test('reply to any clock they send, 2', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: { alice: true, bob: true },
      blocks: {},
      peers: {}
    }

    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: 3, charles: 1 } })
    t.deepEqual(state.peers.bob.notes, { bob: note(2, true) })

    state = events.notes(state, { id: 'bob', value: { alice: note(3, true) } })

    // notes hasn't been sent, so this is merged with previous
    t.deepEqual(state.peers.bob.notes, { alice: note(3, false), bob: note(2, true) })

    state = events.follow(state, { id: 'charles', value: true })
    t.deepEqual(state.peers.bob.notes, { alice: note(3, false), bob: note(2, true), charles: note(0, true) })

    t.end()
  })

  test('append when not in TX mode', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: { alice: true, bob: true },
      blocks: {},
      peers: {}
    }
    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: 3, charles: 1 } })
    t.deepEqual(state.peers.bob.notes, { bob: note(2, true) })

    state = events.notes(state, { id: 'bob', value: { alice: note(3, false) } })
    let rep = state.peers.bob.replicating.alice
    t.equal(rep.tx, false)
    t.equal(rep.sent, 3)

    console.log(state.peers.bob.replicating)

    state = events.append(state, { author: 'alice', sequence: 4, content: {} })
    t.deepEqual(state.peers.bob.notes, { bob: note(2, true), alice: note(4, false) })
    rep = state.peers.bob.replicating.alice
    t.equal(rep.tx, false)
    t.equal(rep.sent, 3)

    state = events.notes(state, { id: 'bob', value: { alice: note(3, true) } })
    t.deepEqual(state.peers.bob.retrive, ['alice'])

    t.end()
  })

  test('note when not in RX mode', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: { alice: true, bob: true },
      blocks: {},
      peers: {
        bob: {
          clock: { alice: 3, bob: 2 },
          retrive: [],
          msgs: [],
          notes: null,
          replicating: {
            alice: {
              tx: false, rx: false, sent: 3
            }
          }
        }
      }
    }

    state = events.notes(state, { id: 'bob', value: { alice: note(5, false) } })
    const rep = state.peers.bob.replicating.alice
    //  t.equal(rep.tx, true)
    t.equal(rep.rx, true)
    t.equal(rep.sent, 5)
    t.deepEqual(state.peers.bob.notes, { alice: note(3, true) })

    console.log(state.peers.bob.replicating)

    //  state = events.append(state, {author: 'alice', sequence: 4, content: {}})
    //  t.deepEqual(state.peers.bob.notes, {bob: note(2, true), alice: note(4, false)})
    t.end()
  })

  test('note when value is not integer', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: { alice: true, bob: true },
      blocks: {},
      peers: {}
    }

    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: {} })

    t.deepEqual(state.peers.bob.clock, {})
    state = events.notes(state, { id: 'bob', value: { alice: true } })

    t.deepEqual(state.peers.bob.clock, { alice: -1 })
    t.deepEqual(state.peers.bob.notes, { alice: note(3, true), bob: note(2, true) })

    t.end()
  })

  test('test sends empty clock if nothing needed', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: { alice: true, bob: true },
      blocks: {},
      peers: {}
    }

    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: 3, bob: 2 } })

    t.deepEqual(state.peers.bob.clock, { alice: 3, bob: 2 })
    t.deepEqual(state.peers.bob.notes, {})

    // receive empty clock
    state = events.notes(state, { id: 'bob', value: {} })
    t.deepEqual(state.peers.bob.replicating, {})

    t.end()
  })

  test('connects in sync then another message', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: { alice: true, bob: true },
      blocks: {},
      peers: {}
    }

    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: 3, bob: 2 } })

    t.deepEqual(state.peers.bob.clock, { alice: 3, bob: 2 })
    t.deepEqual(state.peers.bob.notes, {})

    // receive empty clock
    state = events.notes(state, { id: 'bob', value: {} })
    t.deepEqual(state.peers.bob.replicating, {})

    state = events.append(state, { author: 'alice', sequence: 4, content: {} })
    t.deepEqual(state.peers.bob.notes, { alice: note(4, false) })

    t.end()
  })

  test('unfollow', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: {},
      blocks: {},
      peers: {}
    }

    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: {} })

    t.deepEqual(state.peers.bob.clock, {})
    t.deepEqual(state.peers.bob.notes, { })
    state = events.notes(state, { id: 'bob', value: { alice: note(3, true), bob: note(2, true) } })
    t.deepEqual(state.peers.bob.notes, { alice: note(-1, true), bob: note(-1, true) })

    state.peers.bob.notes = null

    state = events.follow(state, { id: 'alice', value: false })

    t.deepEqual(state.peers.bob.notes, null)

    state = events.notes(state, { id: 'bob', value: { charles: note(-1, true) } })
    t.deepEqual(state.peers.bob.notes, { charles: note(-1, true) })
    state.peers.bob.notes = null
    state = events.notes(state, { id: 'bob', value: { charles: note(-1, true) } })
    t.deepEqual(state.peers.bob.notes, null)

    t.end()
  })

  test('remember clock of unfollow', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: { alice: true },
      blocks: {},
      peers: {}
    }

    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: -1 } })

    t.deepEqual(state.peers.bob.clock, { alice: -1 })
    t.deepEqual(state.peers.bob.notes, {})

    t.end()
  })

  test('notes can be passed inside {clock:{}} object', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: { alice: true },
      blocks: {},
      peers: {}
    }
    state = events.connect(state, { id: 'bob', client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: -1 } })

    state = events.notes(state, {
      id: 'bob',
      value: {
        clock: { bob: note(4, true) }
      }
    })

    t.equal(state.peers.bob.clock.bob, 4)
    t.end()
  })

  test('test if timeout happens while loading', function (t) {
    let state = {
      clock: { alice: 3, bob: 2 },
      follows: { alice: true, bob: true },
      blocks: {},
      peers: {},
      timeout: 1
    }

    state = events.connect(state, { id: 'bob', ts: 1, client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: note(0, true), bob: note(0, true) } })

    state = events.connect(state, { id: 'charles', ts: 2, client: false })
    console.log(state)
    state = events.timeout(state, { ts: 4 })

    t.end()
  })

  test('test blocks while connected', function (t) {
    let state = {
      id: 'alice', // we are alice
      clock: { alice: 3, bob: 2 },
      follows: { alice: true, bob: true },
      blocks: {},
      peers: {},
      timeout: 1
    }

    state = events.connect(state, { id: 'bob', ts: 1, client: false })
    state = events.peerClock(state, { id: 'bob', value: { alice: note(0, true), bob: note(0, true) } })

    // charles blocks bob
    state = events.block(state, { id: 'charles', target: 'bob', value: true })
    t.deepEqual(state.blocks, { charles: { bob: true } })
    t.notOk(state.peers.bob.blocked)
    state = events.block(state, { id: 'alice', target: 'bob', value: true })
    t.deepEqual(state.blocks, { charles: { bob: true }, alice: { bob: true } })
    t.equal(state.peers.bob.blocked, true)

    state = events.timeout(state, { ts: 4 })

    t.end()
  })
}

if (!module.parent) { module.exports(require('./options')) }
