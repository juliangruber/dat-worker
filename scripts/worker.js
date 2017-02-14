'use strict'

const Dat = require('dat-node')
const debounce = require('debounce')
const {toStr} = require('dat-encoding')

const key = process.argv[2]
const dir = process.argv[3]
const opts = JSON.parse(process.argv[4])

const send = m => process.send(m)

const error = err => send({
  type: 'error',
  msg: { message: err.message, stack: err.stack }
})

Dat(dir, { key }, (err, dat) => {
  if (err) return error(err)
  const update = debounce(() => send({
    type: 'update',
    msg: {
      stats: stats.get(),
      network: {
        connected: network.connected
      },
      owner: dat.owner,
      key: toStr(dat.key),
      archive: {
        content: {
          bytes: dat.archive.content && dat.archive.content.bytes
        }
      }
    }
  }), 200)

  if (dat.owner) {
    const importer = dat.importFiles(opts, err => {
      if (err) error(err)
      update()
    })
    importer.on('file imported', update)
  }

  const network = dat.joinNetwork()
  network.on('connection', peer => {
    update()
    peer.once('close', update)
  })

  const stats = dat.trackStats()

  dat.archive.on('download', update)

  update()
})

