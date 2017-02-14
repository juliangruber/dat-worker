'use strict'

const {fork} = require('child_process')
const {EventEmitter} = require('events')
const {toBuf, toStr} = require('dat-encoding')
const slice = require('slice-file')
const JSONStream = require('JSONStream')
const {PassThrough} = require('stream')
const fs = require('fs')

const workerPath = `${__dirname}/scripts/worker.js`

module.exports = class Worker extends EventEmitter {
  constructor ({ key, dir, opts }) {
    super()
    this.key = key
    this.dir = this.path = dir
    this.opts = opts
    this.proc = null
    this.db = {
      close: cb => setImmediate(cb)
    }
    this.stats = {
      get: () => { return {} }
    }
    const deferReadable = (fn, opts) => (...args) => {
      const out = new PassThrough(opts)
      out.destroy = () => {
        out.destroyed = true
        out.emit('destroy')
      }
      const onready = () => fn(out, ...args)
      if (this.ready) onready()
      else this.once('ready', onready)
      return out
    }
    this.archive = {
      content: null,
      list: deferReadable((out, opts) => {
        if (out.destroyed) return
        const path = `/tmp/dat-worker-${Math.random().toString(16)}`
        fs.writeFile(path, '', err => {
          if (err) return out.emit('error', err)
          if (out.destroyed) return

          this.proc.send({
            type: 'list',
            msg: {
              path,
              opts: opts
            }
          })

          const sl = slice(path)
          const rs = sl.follow()
          const tr = JSONStream.parse([true])
          rs.pipe(tr).pipe(out)

          out.on('destroy', () => sl.close())
        })
      }, { objectMode: true }),
      createFileReadStream: deferReadable((out, entry, opts) => {
        const path = `/tmp/dat-worker-${Math.random().toString(16)}`
        fs.writeFile(path, '', err => {
          if (err) return out.emit('error', err)
          this.proc.send({
            type: 'createFileReadStream',
            msg: {
              path,
              entry,
              opts
            }
          })
          const onmessage = ({ type, msg }) => {
            if (type === 'read-finish' && msg === path) {
              this.proc.removeListener('message', onmessage)
              fs.createReadStream(path).pipe(out)
            }
          }
          this.proc.on('message', onmessage)
        })
      })
    }
    this.ready = false
  }
  start (cb) {
    if (cb) this.once('ready', cb)
    const proc =
    this.proc = fork(workerPath, [
      this.key
        ? toStr(this.key)
        : undefined,
      this.dir,
      JSON.stringify(this.opts)
    ])
    proc.on('message', ({ type, msg }) => {
      switch (type) {
        case 'error':
          const err = new Error(msg.message)
          err.stack = msg.stack
          this.emit('error', err)
          break
        case 'update':
          msg.key = toBuf(msg.key)
          this.stats.get = () => msg.stats
          this.network = msg.network
          this.owner = msg.owner
          this.key = toBuf(msg.key)
          if (typeof msg.archive.content.bytes === 'number') {
            this.archive.content = { bytes: msg.archive.content.bytes }
          }
          this.emit('update')
          break
        case 'ready':
          this.ready = true
          this.emit('ready')
          break
        case 'read-finish':
          // handled above
          break
        default:
          this.emit('error', new Error(`Unknown event: ${type}`))
      }
    })
    proc.on('exit', () => this.emit('exit'))
  }
  info () {
    return this.info
  }
  close (cb) {
    if (cb) this.on('exit', cb)
    this.proc.kill()
  }
}
