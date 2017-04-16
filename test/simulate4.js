var u = require('../util')
var sim = require('../simulate')

sim.runner(process.argv[2], sim.basic(3,4,'AB,BC,CD,DA'))

