/** Empty stub for Node.js dgram module (UDP) - not available in browser */
const stub = {
  createSocket() {
    throw new Error('UDP not available in browser')
  },
}
export default stub
