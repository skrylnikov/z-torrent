import corePath from 'path'
import fs from 'fs'
import { isNotJunk } from 'junk'
import { once } from '@z-torrent/utils'
import parallel from 'run-parallel'

interface FileInfo {
  length: number
  path: string
  getStream?: () => fs.ReadStream
}

function traversePath(
  path: string,
  fn: (path: string, cb: (err: Error | null, result?: FileInfo | FileInfo[]) => void) => void,
  cb: (err: Error | null, result?: FileInfo | FileInfo[]) => void
): void {
  fs.stat(path, (err, stats) => {
    if (err) return cb(err)
    if (stats.isDirectory()) {
      fs.readdir(path, (err, entries) => {
        if (err) return cb(err)
        parallel(
          entries
            .filter(notHidden)
            .filter(isNotJunk)
            .map((entry) => (cb: (err: Error | null, result?: FileInfo | FileInfo[]) => void) => {
              traversePath(corePath.join(path, entry), fn, cb)
            }),
          cb
        )
      })
    } else if (stats.isFile()) {
      fn(path, cb)
    }
  })
}

function getFilePathStream(path: string): () => fs.ReadStream {
  return () => fs.createReadStream(path)
}

function notHidden(filename: string): boolean {
  return filename[0] !== '.'
}

export default function getFiles(
  path: string,
  keepRoot: boolean,
  cb: (err: Error | null, files?: FileInfo[]) => void
): void {
  traversePath(path, getFileInfo, (err, files) => {
    if (err) return cb(err)

    let fileArray: FileInfo[]
    if (Array.isArray(files)) fileArray = files.flat(Infinity) as FileInfo[]
    else fileArray = [files]

    fileArray.sort((a, b) => {
      const pathA = Array.isArray(a.path) ? a.path.join('/') : a.path
      const pathB = Array.isArray(b.path) ? b.path.join('/') : b.path
      return pathA.localeCompare(pathB)
    })

    const basePath = keepRoot ? corePath.dirname(path) : path
    let normalizedPath = basePath
    if (!normalizedPath.endsWith(corePath.sep)) normalizedPath += corePath.sep

    fileArray.forEach((file) => {
      file.getStream = getFilePathStream(file.path)
      file.path = file.path.replace(normalizedPath, '').split(corePath.sep)
    })

    cb(null, fileArray)
  })
}

function getFileInfo(path: string, cb: (err: Error | null, info?: FileInfo) => void): void {
  const callback = once(cb) as (err: Error | null, info?: FileInfo) => void
  fs.stat(path, (err, stat) => {
    if (err) return callback(err)
    const info: FileInfo = {
      length: stat.size,
      path,
    }
    callback(null, info)
  })
}

export type { FileInfo }
