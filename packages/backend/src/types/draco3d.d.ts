declare module 'draco3d' {
  interface Draco3DModuleFactory {
    createDecoderModule: () => Promise<unknown>
    createEncoderModule: () => Promise<unknown>
  }

  const draco3d: Draco3DModuleFactory
  export default draco3d
}
