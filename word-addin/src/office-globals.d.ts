declare const Office: {
  onReady: (callback: () => void | Promise<void>) => void
  context: {
    platform?: string
  } & {
    document: {
      customXmlParts?: {
        getByNamespaceAsync: (
          namespace: string,
          callback: (result: { status: string; value?: any[]; error?: unknown }) => void,
        ) => void
        addAsync: (
          xml: string,
          callback: (result: { status: string; error?: unknown }) => void,
        ) => void
      }
      settings?: {
        get: (key: string) => unknown
        set: (key: string, value: string) => void
        saveAsync: (callback: (result: { status: string; error?: unknown }) => void) => void
      }
    }
  }
}

declare const Word: {
  run: <T>(callback: (context: any) => Promise<T>) => Promise<T>
  InsertLocation: {
    replace: any
    end: any
  }
  ContentControlAppearance: {
    boundingBox: any
    hidden: any
  }
}
