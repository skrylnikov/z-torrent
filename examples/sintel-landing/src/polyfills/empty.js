/** Empty stub for Node.js modules not used in browser (dgram, etc.) */
const stub = {
  createSocket() {
    throw new Error('UDP not available in browser')
  },
}
export default stub
