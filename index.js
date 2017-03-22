'use strict'
const fork = require('child_process').fork
const EventEmitter = require('events')
const enc = require('dat-encoding')
const PassThrough = require('stream').PassThrough
const Readable = require('stream').Readable
const fs = require('fs')
const extend = require('xtend')
const debug = require('debug')('dat-worker:host')
const createIpcHelper = require('./lib/ipc')

const workerPath = `${__dirname}/scripts/worker.js`
const noop = () => {
}

module.exports = (dir, opts, cb) => {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  debug('init %s (key=%s)', dir, opts.key)

  const w = new EventEmitter()
  w.key = opts.key
  w.path = w.dir = dir
  w.db = { close: cb => setImmediate(cb) }
  w.stats = {}
  w.archive = {
    list: opts => {
      const id = Date.now() + Math.random()
      const out = PassThrough({ objectMode: true })

      out.destroy = () => {
        proc.send({ type: id })
        off()
        out.emit('destroy')
      }

      proc.send({ type: 'list', msg: { opts, id } })

      const off = on(id, entry => {
        out.push(entry)
      })

      return out
    },
    createFileReadStream: (entry, opts) => {
      const out = new PassThrough()
      const id = Date.now() + Math.random()
      proc.send({ type: 'createFileReadStream', msg: { id, entry, opts } })
      const offChunk = on(id, str => {
        out.push(Buffer(str, 'hex'))
      })
      const offEnd = on(`end ${id}`, () => {
        out.push(null)
        offChunk()
        offEnd()
      })
      return out
    }
  }
  w.close = cb => {
    if (cb) proc.on('exit', cb)
    proc.kill()
  }
  w.join = w.joinNetwork = () => {
    proc.send({ type: 'joinNetwork' })
  }
  w.leave = w.leaveNetwork = () => {
    proc.send({ type: 'leaveNetwork' })
  }

  debug('fork %s key=%s dir=%s opts=%j', workerPath, w.key, w.dir, opts)

  const proc = fork(
    workerPath,
    [ w.key ? enc.toStr(w.key) : undefined, w.dir, JSON.stringify(opts) ],
    {
      env: extend(process.env, opts.env),
      silent: true,
      stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ]
    }
  )
  w.stdout = Readable().wrap(proc.stdout)
  if (opts.stdout) w.stdout.pipe(opts.stdout)
  w.stderr = Readable().wrap(proc.stderr)
  if (opts.stderr) w.stderr.pipe(opts.stderr)

  const on = createIpcHelper(proc)

  on('update', msg => {
    msg.key = enc.toBuf(msg.key)
    w.stats.get = () => msg.stats
    w.stats.network = msg.statsNetwork
    w.network = msg.network
    w.owner = msg.owner
    w.key = w.archive.key = enc.toBuf(msg.key)
    if (typeof msg.archive.content.bytes === 'number') {
      w.archive.content = { bytes: msg.archive.content.bytes }
    }
    w.emit('update')
  })

  const off = on('*', (msg, type) => {
    if (type === 'update') return
    debug('got init message (%s - %j)', type, msg)

    switch (type) {
      case 'error':
        const err = new Error(msg.message)
        err.stack = msg.stack
        proc.kill()
        cb(err)
        break
      case 'ready':
        off()
        cb(null, w)
        on('error', msg => {
          const err = new Error(msg.message)
          err.stack = msg.stack
          w.emit('error', err)
          proc.kill()
        })
    }
  })

  return w
}
