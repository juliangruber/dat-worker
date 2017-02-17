'use strict'

const spawn = require('child_process').spawn
const EventEmitter = require('events')
const enc = require('dat-encoding')
const slice = require('slice-file')
const JSONStream = require('JSONStream')
const PassThrough = require('stream').PassThrough
const fs = require('fs')
const extend = require('xtend')

const workerPath = `${__dirname}/scripts/worker.js`

module.exports = (dir, opts, cb) => {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  const w = new EventEmitter()
  w.key = opts.key
  w.path = w.dir = dir
  w.db = { close: cb => setImmediate(cb) }
  w.stats = {}
  w.archive = {
    list: opts => {
      const out = new PassThrough({ objectMode: true })
      let destroyed = false
      out.destroy = () => {
        destroyed = true
        out.emit('destroy')
      }

      const path = `/tmp/dat-worker-${Math.random().toString(16)}`
      fs.writeFile(path, '', err => {
        if (destroyed) return
        if (err) return out.emit('error', err)

        proc.send({
          type: 'list',
          msg: {
            path,
            opts: opts
          }
        })

        const sl = slice(path)
        const rs = sl.follow()
        rs.on('error', () => {}) // FIXME
        const tr = JSONStream.parse([true])
        tr.on('error', () => {}) // FIXME
        rs.pipe(tr).pipe(out)

        out.on('destroy', () => {
          sl.close()
        })
      })

      return out
    },
    createFileReadStream: (entry, opts) => {
      const out = new PassThrough()
      const path = `/tmp/dat-worker-${Math.random().toString(16)}`
      fs.writeFile(path, '', err => {
        if (err) return out.emit('error', err)
        proc.send({
          type: 'createFileReadStream',
          msg: {
            path,
            entry,
            opts
          }
        })
        const onmessage = obj => {
          const type = obj.type
          const msg = obj.msg

          if (type === 'read-finish' && msg === path) {
            proc.removeListener('message', onmessage)
            const rs = fs.createReadStream(path)
            rs.pipe(out)
            rs.on('close', () => {
              fs.unlink(path, err => {
                if (err) out.emit('error', err)
              })
            })
          }
        }
        proc.on('message', onmessage)
      })
      return out
    }
  }
  w.close = cb => {
    if (cb) proc.on('exit', cb)
    proc.kill()
  }

  const proc = spawn(opts.execPath || 'node', [
    workerPath,
    w.key
      ? enc.toStr(w.key)
      : undefined,
    w.dir,
    JSON.stringify(opts)
  ], {
    env: extend(process.env, opts.env),
    silent: true,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  })
  w.stdout = proc.stdout
  w.stderr = proc.stderr

  proc.on('message', obj => {
    const type = obj.type
    const msg = obj.msg

    switch (type) {
      case 'update':
        msg.key = enc.toBuf(msg.key)
        w.stats.get = () => msg.stats
        w.network = msg.network
        w.owner = msg.owner
        w.key = w.archive.key = enc.toBuf(msg.key)
        if (typeof msg.archive.content.bytes === 'number') {
          w.archive.content = { bytes: msg.archive.content.bytes }
        }
        w.emit('update')
    }
  })

  const onInitMessage = obj => {
    const type = obj.type
    const msg = obj.msg

    switch (type) {
      case 'error':
        const err = new Error(msg.message)
        err.stack = msg.stack
        proc.kill()
        cb(err)
        break
      case 'ready':
        proc.removeListener('message', onInitMessage)
        cb(null, w)
    }
  }
  proc.on('message', onInitMessage)

  return w
}
