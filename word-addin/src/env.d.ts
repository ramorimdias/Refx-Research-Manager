/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REFX_ADDIN_ENV?: 'development' | 'production'
  readonly VITE_REFX_BRIDGE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
