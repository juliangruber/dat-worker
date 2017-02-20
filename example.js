'use strict'
const Dat = require('.')
const fs = require('fs')

try {
  fs.mkdirSync('/tmp/dat-worker-example')
} catch (_) {
}

Dat('/tmp/dat-worker-example', {}, (err, dat) => {
  if (err) throw err

  /* dat.on('update', () => {
    console.log(dat.key)
  }) */
  const listStream = dat.archive.list({ live: true })
  listStream.once('data', () => listStream.destroy())
  listStream.on('data', () => process.stdout.write('.'))

  dat.stdout.pipe(process.stdout, { end: false })
  dat.stderr.pipe(process.stderr, { end: false })
  // dat.archive.createFileReadStream('dat.json').pipe(process.stdout)
})
