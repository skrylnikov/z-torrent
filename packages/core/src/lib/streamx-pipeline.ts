import * as streamx from 'streamx'

type PipelineFn = (...streams: unknown[]) => void

const sx = streamx as typeof streamx & { pipeline: PipelineFn }

export const pipeline: PipelineFn = (...streams) => sx.pipeline(...streams)
