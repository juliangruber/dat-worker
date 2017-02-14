'use strict'

const {fork} = require('child_process')
const {EventEmitter} = require('events')

const workerPath = `${__dirname}/scripts/worker.js`

module.exports = class Worker extends EventEmitter {
  constructor ({ key, dir, opts }) {
    super()
    this.key = key
    this.dir = dir
    this.opts = opts
    this.proc = null
    this.info = { key }
  }
  start () {
    const proc =
    this.proc = fork(workerPath, [
      this.key,
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
          this.info = msg
          this.emit('update', this.info)
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
  kill (cb) {
    if (cb) this.on('exit', cb)
    this.proc.kill()
  }
}

