declare module 'qrcode' {
  export function toDataURL(
    text: string,
    options?: {
      errorCorrectionLevel?: 'low' | 'medium' | 'quartile' | 'high' | 'L' | 'M' | 'Q' | 'H'
      margin?: number
      scale?: number
      width?: number
    },
  ): Promise<string>
}
