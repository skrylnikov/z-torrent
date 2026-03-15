import os from 'os'
import fs from 'fs'
import path from 'path'

const getDownloadPath = (infix: string, infoHash: string): string => {
  let tmpPath: string
  try {
    tmpPath = path.join(fs.statSync('/tmp') && '/tmp')
  } catch (err) {
    tmpPath = path.join(typeof os.tmpdir === 'function' ? os.tmpdir() : '/')
  }
  return path.join(tmpPath, 'z-torrent', 'test', infix, infoHash)
}

export default { getDownloadPath }
