'use strict'
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
const on = require('../lib/ipc')(process)

debug('starting dat-node %s (key=%s)', dir, key)

Dat(dir, { key }, (err, dat) => {
  if (err) {
    debug('dat-node error %s', err)
    return error(err)
  }

  debug('started dat-node %s (key=%s)', dir, key)

  const stats = dat.trackStats()

  const _update = () =>
    send({
      type: 'update',
      msg: {
        stats: stats.get(),
        statsNetwork: {
          downloadSpeed: stats.network.downloadSpeed,
          uploadSpeed: stats.network.uploadSpeed
        },
        network: dat.network && { connected: dat.network.connected },
        owner: dat.owner,
        key: toStr(dat.key),
        archive: {
          content: { bytes: dat.archive.content && dat.archive.content.bytes }
        }
      }
    })
  const update = debounce(_update, 200)

  on('list', msg => {
    const rs = dat.archive.list({ opts: msg.opts })
    rs.on('data', entry => {
      send({ type: msg.id, msg: entry })
    })
    on(msg.id, () => rs.destroy())
  })

  on('createFileReadStream', msg => {
    const rs = dat.archive.createFileReadStream(msg.entry, msg.opts)
    rs.on('data', buf => {
      send({ type: msg.id, msg: buf.toString('hex') })
    })
    rs.on('close', () => {
      send({ type: `close-${msg.id}` })
    })
  })

  on('joinNetwork', msg => {
    dat.joinNetwork()
    dat.network.on('connection', peer => {
      update()
      peer.once('close', () => {
        update()
        // https://github.com/datproject/dat-desktop/issues/227
        setTimeout(update, 1000)
      })
    })
    update()
  })

  on('leaveNetwork', msg => {
    dat.leaveNetwork()
    delete dat.network
    update()
  })

  if (dat.owner) {
    const importer = dat.importFiles(opts, err => {
      if (err) error(err)
      update()
    })
    importer.on('file imported', update)
  }

  dat.archive.on('download', update)

  _update()
  send({ type: 'ready' })
})
