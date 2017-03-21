// IPC helper
module.exports = proc => (type, fn) => {
  const onMessage = obj => {
    if (obj.type !== type && type !== '*') return
    fn(obj.msg, obj.type)
  }
  proc.on('message', onMessage)
  const off = () => proc.removeListener('message', onMessage)
  return off
}
