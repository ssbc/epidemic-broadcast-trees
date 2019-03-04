

var v3 = require('../v3')

var tape = require('tape')

tape('v3 can handle fork and block', function (t) {
  t.equal(v3.note(-2, true), -2) //forked
  t.equal(v3.note(-1, true), -1) //blocked
  t.equal(v3.note(0, true), 0) //replicating, please send
  t.equal(v3.note(0, false), 1) //replicating, but don't send
  t.equal(v3.note(1, true), 2) //replicating, please send
  t.equal(v3.note(1, false), 3) //replicating, but don't send
  t.equal(v3.note(2, true), 4) //replicating, please send
  t.equal(v3.note(2, false), 5) //replicating, but don't send

  t.equal(v3.isForked(-2), true)
  t.equal(v3.isNotReplicate(-1), true)
  t.equal(v3.isForked(-1), false)
  t.equal(v3.isNotReplicate(-2), false)
  t.equal(v3.isForked(1), false)
  t.equal(v3.isNotReplicate(1), false)

  t.equal(v3.getReceive(-1), false)
  t.equal(v3.getReceive(-2), false)
  t.equal(v3.getReplicate(-1), false)
  t.equal(v3.getReplicate(-2), false)

  t.end()
})










