'use strict'

const Dat = require('.')
const fs = require('fs')

try { fs.mkdirSync('/tmp/dat-worker-example') } catch (_) {}

Dat('/tmp/dat-worker-example', {
  /* key: 'f34f99538702f3b55ea3b88c9e374fb72db0ca35903c2249aaa09280accc2062', */
}, (err, dat) => {
  if (err) throw err

  /* dat.on('update', () => {
    console.log(dat.key)
  }) */

  // dat.archive.list({ live: true }).on('data', () => process.stdout.write('.'))

  dat.archive.createFileReadStream('dat.json').pipe(process.stdout)
})
