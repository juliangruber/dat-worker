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
    this.dir = dir
    this.opts = opts
    this.proc = null
    this.db = {
      close: cb => setImmediate(cb)
    }
    const deferReadable = (fn, opts) => (...args) => {
      const out = new PassThrough(opts)
      const onready = () => fn(out, ...args)
      if (this.ready) onready()
      else this.once('ready', onready)
      return out
    }
    this.archive = {
      content: {},
      list: deferReadable((out, opts) => {
        const path = `/tmp/dat-worker-${Math.random().toString(16)}`
        fs.writeFile(path, '', err => {
          if (err) return out.emit('error', err)
          this.proc.send({
            type: 'list',
            msg: {
              path,
              opts: opts
            }
          })
          slice(path).follow()
          .pipe(JSONStream.parse([true]))
          .pipe(out)
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
          slice(path).follow().pipe(out)
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
          this.stats = () => msg.stats
          this.network = msg.network
          this.owner = msg.owner
          this.key = toBuf(msg.key)
          this.archive.content.bytes = msg.archive.content.bytes
          this.emit('update')
          break
        case 'ready':
          this.ready = true
          this.emit('ready')
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

