import corePath from 'path'
import fs from 'fs'
import { isNotJunk } from 'junk'
import { once } from '@z-torrent/utils'
import parallel from 'run-parallel'

import type { ReadStream } from 'node:fs'

/** Normalized file entry returned to create-torrent (path segments relative to torrent root). */
export interface FileInfo {
  length: number
  path: string[]
  getStream?: () => ReadStream
}

interface CollectedFile {
  length: number
  path: string
}

class GetFilesImpl {
  static getFiles(
    rootPath: string,
    keepRoot: boolean,
    cb: (err: Error | null, files?: FileInfo[]) => void
  ): void {
    GetFilesImpl.#traversePath(rootPath, GetFilesImpl.#getFileInfo, (err, files) => {
      if (err) return cb(err)

      let fileArray: CollectedFile[]
      if (Array.isArray(files)) fileArray = files.flat(Infinity) as CollectedFile[]
      else fileArray = [files as CollectedFile]

      fileArray.sort((a, b) => a.path.localeCompare(b.path))

      const basePath = keepRoot ? corePath.dirname(rootPath) : rootPath
      let normalizedPath = basePath
      if (!normalizedPath.endsWith(corePath.sep)) normalizedPath += corePath.sep

      const out: FileInfo[] = fileArray.map((file) => ({
        length: file.length,
        path: file.path.replace(normalizedPath, '').split(corePath.sep),
        getStream: GetFilesImpl.#getFilePathStream(file.path),
      }))

      cb(null, out)
    })
  }

  static #getFilePathStream(absPath: string): () => ReadStream {
    return () => fs.createReadStream(absPath)
  }

  static #notHidden(filename: string): boolean {
    return filename[0] !== '.'
  }

  static #traversePath(
    path: string,
    fn: (
      path: string,
      cb: (err: Error | null, result?: CollectedFile | CollectedFile[]) => void
    ) => void,
    cb: (err: Error | null, result?: CollectedFile | CollectedFile[]) => void
  ): void {
    fs.stat(path, (err, stats) => {
      if (err) return cb(err)
      if (stats.isDirectory()) {
        fs.readdir(path, (errRead, entries) => {
          if (errRead) return cb(errRead)
          parallel(
            entries
              .filter(GetFilesImpl.#notHidden)
              .filter(isNotJunk)
              .map(
                (entry) =>
                  (pcb: (err: Error | null, result?: CollectedFile | CollectedFile[]) => void) => {
                    GetFilesImpl.#traversePath(corePath.join(path, entry), fn, pcb)
                  }
              ),
            cb
          )
        })
      } else if (stats.isFile()) {
        fn(path, cb)
      }
    })
  }

  static #getFileInfo(path: string, cb: (err: Error | null, info?: CollectedFile) => void): void {
    const callback = once(cb) as (err: Error | null, info?: CollectedFile) => void
    fs.stat(path, (err, stat) => {
      if (err) return callback(err)
      callback(null, { length: stat.size, path })
    })
  }
}

export function getFiles(
  path: string,
  keepRoot: boolean,
  cb: (err: Error | null, files?: FileInfo[]) => void
): void {
  GetFilesImpl.getFiles(path, keepRoot, cb)
}
