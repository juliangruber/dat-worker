'use strict'
const Dat = require('.')
const fs = require('fs')
const log = require('console-stream')()

const dir = process.argv[2] || '/tmp/dat-worker-example'

try {
  fs.mkdirSync(dir)
} catch (_) {
}

Dat(dir, { stdout: log, stderr: log }, (err, dat) => {
  if (err) throw err

  /* setInterval(
    () => {
      console.log('network', dat.stats.network)
    },
    1000
  ) */
  const listStream = dat.archive.list({ live: true })
  listStream.once('data', () => listStream.destroy())
  listStream.on('data', () => process.stdout.write('.'))

  dat.stdout.pipe(process.stdout, { end: false })
  dat.stderr.pipe(process.stderr, { end: false })
  // dat.archive.createFileReadStream('dat.json').pipe(process.stdout)
})
