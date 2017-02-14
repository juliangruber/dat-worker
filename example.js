'use strict'

const Worker = require('.')
const fs = require('fs')

try { fs.mkdirSync('/tmp/dat-worker-example') } catch (_) {}

const w = new Worker({
  key: 'f34f99538702f3b55ea3b88c9e374fb72db0ca35903c2249aaa09280accc2062',
  dir: '/tmp/dat-worker-example',
  opts: {}
})

w.on('error', err => {
  throw err
})

w.archive.list({ live: true }).on('data', () => process.stdout.write('.'))

w.archive.createFileReadStream('dat.json').pipe(process.stdout)

w.start()
