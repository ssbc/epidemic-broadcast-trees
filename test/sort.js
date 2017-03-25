var tape = require('tape')
var u = require('../util')

tape('set sorting', function (t) {

  var ary = [
    {value: {timestamp: 1}},
    {value: {timestamp: 2}},
    {value: {timestamp: 3}},
    {value: null},
    {value: null},
  ]

  while(ary.length) {
    for(var i = 0; i < 10; i++) {
      var _ary = ary.slice().sort(function () { return Math.random() - 0.5 })
      t.deepEqual(u.sort(_ary), ary)
    }
    ary.shift()
  }

  t.end()
})





