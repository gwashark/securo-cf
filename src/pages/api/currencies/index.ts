import type { APIRoute } from 'astro'

const SUPPORTED = 'USD,EUR,GBP,BRL,CAD,AUD,CHF,ARS,JPY,MXN,INR,SEK,DKK,NOK,PLN,CZK,HUF,RON,CRC,IDR,COP,CLP,DOP,RUB,GTQ,PHP,UAH,NZD,VND,SGD,AZN,TRY,PKR,MDL,AED,THB,EGP,MYR,CNY,SAR,QAR,JMD,RSD'.split(',')

export const GET: APIRoute = () => {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' })
  return Response.json(SUPPORTED.map((code) => ({
    code,
    symbol: (() => {
      try {
        return new Intl.NumberFormat('en', { style: 'currency', currency: code }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? code
      } catch { return code }
    })(),
    name: displayNames.of(code) ?? code,
    flag: '',
  })))
}