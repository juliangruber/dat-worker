'use strict'
require('debug').enable((process.env.DEBUG || '') + ',dat-worker*')

// Nothing should fail here
const debug = require('debug')('dat-worker:worker')

const key = process.argv[2] !== 'undefined' ? process.argv[2] : undefined
const dir = process.argv[3]
const opts = JSON.parse(process.argv[4])

debug('init dir=%s key=%s', dir, key)

// Exception logging
const send = m => {
  process.send(m, err => {
    if (err) process.exit(1)
  })
}

const error = err =>
  send({ type: 'error', msg: { message: err.message, stack: err.stack } })

process.on('uncaughtException', err => error(err))

// Main code
const Dat = require('dat-node')
const debounce = require('debounce')
const toStr = require('dat-encoding').toStr
const fs = require('fs')
const JSONStream = require('JSONStream')

debug('starting dat-node %s (key=%s)', dir, key)

Dat(dir, { key }, (err, dat) => {
  if (err) {
    debug('dat-node error %s', err)
    return error(err)
  }

  debug('started dat-node %s (key=%s)', dir, key)

  const _update = () =>
    send({
      type: 'update',
      msg: {
        stats: stats.get(),
        network: { connected: network.connected },
        owner: dat.owner,
        key: toStr(dat.key),
        archive: {
          content: { bytes: dat.archive.content && dat.archive.content.bytes }
        }
      }
    })
  const update = debounce(_update, 200)

  process.on('message', obj => {
    const type = obj.type
    const msg = obj.msg
    let rs, tr, ws

    switch (type) {
      case 'list':
        rs = dat.archive.list({ opts: msg.opts })
        tr = JSONStream.stringify()
        ws = fs.createWriteStream(msg.path)
        rs.pipe(tr)
        tr.on('data', d => ws.write(`${d}\n`))
        break
      case 'createFileReadStream':
        rs = dat.archive.createFileReadStream(msg.entry, msg.opts)
        ws = fs.createWriteStream(msg.path)
        rs
          .pipe(ws)
          .on('close', () => send({ type: 'read-finish', msg: msg.path }))
        break
      default:
        error(new Error(`Unknown event: ${type}`))
    }
  })

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

  _update()
  send({ type: 'ready' })
})
