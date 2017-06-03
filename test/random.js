var u = require('../util')
var sim = require('../simulate')

sim.runner(process.argv[2], sim.basic(function (seed) {
  return sim.createRandomNetwork(10,20)
}))

