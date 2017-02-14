'use strict'

const Dat = require('dat-node')
const debounce = require('debounce')
const {toStr} = require('dat-encoding')
const fs = require('fs')
const JSONStream = require('JSONStream')

const key = process.argv[2] !== 'undefined'
  ? process.argv[2]
  : undefined
const dir = process.argv[3]
const opts = JSON.parse(process.argv[4])

const send = m => process.send(m)

const error = err => send({
  type: 'error',
  msg: { message: err.message, stack: err.stack }
})

Dat(dir, { key }, (err, dat) => {
  if (err) return error(err)

  process.on('message', ({ type, msg }) => {
    switch (type) {
      case 'list':
        dat.archive.list({ opts: msg.opts })
          .pipe(JSONStream.stringify())
          .pipe(fs.createWriteStream(msg.path))
        break
      case 'createFileReadStream':
        dat.archive.createFileReadStream(msg.entry, msg.opts)
          .pipe(fs.createWriteStream(msg.path))
        break
      default:
        error(new Error(`Unknown event: ${type}`))
    }
  })
  send({ type: 'ready' })

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
