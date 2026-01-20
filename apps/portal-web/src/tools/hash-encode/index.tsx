import { useState, useCallback } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'hash-encode',
  name: 'Hash & Encode',
  description: 'Calculate hashes and encode/decode text in various formats',
  category: 'Encoding',
  nav_order: 40,
  tags: ['hash', 'md5', 'sha', 'base64', 'url', 'hex', 'encode', 'decode'],
  has_backend: false,
}

type Tab = 'hash' | 'encode' | 'decode'

interface HashResult {
  algorithm: string
  hash: string
}

export function HashEncodeTool() {
  const [activeTab, setActiveTab] = useState<Tab>('hash')
  const [input, setInput] = useState('')
  const [hashResults, setHashResults] = useState<HashResult[]>([])
  const [encodeFormat, setEncodeFormat] = useState('base64')
  const [decodeFormat, setDecodeFormat] = useState('base64')
  const [encodeResult, setEncodeResult] = useState('')
  const [decodeResult, setDecodeResult] = useState('')
  const [decodeError, setDecodeError] = useState('')
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<Set<string>>(
    new Set(['md5', 'sha1', 'sha256', 'sha512'])
  )

  const algorithms = [
    { id: 'md5', name: 'MD5', bits: 128 },
    { id: 'sha1', name: 'SHA-1', bits: 160 },
    { id: 'sha256', name: 'SHA-256', bits: 256 },
    { id: 'sha384', name: 'SHA-384', bits: 384 },
    { id: 'sha512', name: 'SHA-512', bits: 512 },
  ]

  const encodeFormats = [
    { id: 'base64', name: 'Base64' },
    { id: 'base64url', name: 'Base64URL' },
    { id: 'url', name: 'URL Encode' },
    { id: 'hex', name: 'Hexadecimal' },
    { id: 'html', name: 'HTML Entities' },
  ]

  const computeHashes = useCallback(async (text: string) => {
    if (!text) {
      setHashResults([])
      return
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    const results: HashResult[] = []

    for (const algo of algorithms) {
      if (!selectedAlgorithms.has(algo.id)) continue

      try {
        let hash: string
        if (algo.id === 'md5') {
          // MD5 not available in SubtleCrypto, use custom implementation
          hash = md5(text)
        } else {
          const hashBuffer = await crypto.subtle.digest(
            algo.id.toUpperCase().replace('SHA', 'SHA-'),
            data
          )
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        }
        results.push({ algorithm: algo.name, hash })
      } catch {
        results.push({ algorithm: algo.name, hash: 'Error computing hash' })
      }
    }

    setHashResults(results)
  }, [selectedAlgorithms])

  const handleInputChange = (value: string) => {
    setInput(value)
    if (activeTab === 'hash') {
      computeHashes(value)
    } else if (activeTab === 'encode') {
      encode(value, encodeFormat)
    }
  }

  const encode = (text: string, format: string) => {
    if (!text) {
      setEncodeResult('')
      return
    }

    try {
      let result: string
      switch (format) {
        case 'base64':
          result = btoa(unescape(encodeURIComponent(text)))
          break
        case 'base64url':
          result = btoa(unescape(encodeURIComponent(text)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
          break
        case 'url':
          result = encodeURIComponent(text)
          break
        case 'hex':
          result = Array.from(new TextEncoder().encode(text))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
          break
        case 'html':
          result = text.replace(/[&<>"']/g, char => {
            const entities: Record<string, string> = {
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;',
            }
            return entities[char] || char
          })
          break
        default:
          result = text
      }
      setEncodeResult(result)
    } catch {
      setEncodeResult('Error encoding')
    }
  }

  const decode = (text: string, format: string) => {
    if (!text) {
      setDecodeResult('')
      setDecodeError('')
      return
    }

    try {
      let result: string
      switch (format) {
        case 'base64':
          result = decodeURIComponent(escape(atob(text)))
          break
        case 'base64url':
          // Add padding if needed
          let padded = text.replace(/-/g, '+').replace(/_/g, '/')
          while (padded.length % 4) padded += '='
          result = decodeURIComponent(escape(atob(padded)))
          break
        case 'url':
          result = decodeURIComponent(text)
          break
        case 'hex':
          const bytes = text.match(/.{1,2}/g)
          if (!bytes) throw new Error('Invalid hex')
          result = new TextDecoder().decode(
            new Uint8Array(bytes.map(b => parseInt(b, 16)))
          )
          break
        case 'html':
          const textarea = document.createElement('textarea')
          textarea.innerHTML = text
          result = textarea.value
          break
        default:
          result = text
      }
      setDecodeResult(result)
      setDecodeError('')
    } catch (e) {
      setDecodeResult('')
      setDecodeError(`Invalid ${format} input`)
    }
  }

  const handleEncodeFormatChange = (format: string) => {
    setEncodeFormat(format)
    encode(input, format)
  }

  const handleDecodeFormatChange = (format: string) => {
    setDecodeFormat(format)
    decode(input, format)
  }

  const handleDecodeInputChange = (value: string) => {
    setInput(value)
    decode(value, decodeFormat)
  }

  const toggleAlgorithm = (algoId: string) => {
    const newSelected = new Set(selectedAlgorithms)
    if (newSelected.has(algoId)) {
      newSelected.delete(algoId)
    } else {
      newSelected.add(algoId)
    }
    setSelectedAlgorithms(newSelected)
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
  }

  const tabClass = (tab: Tab) =>
    `px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
      activeTab === tab
        ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t border-l border-r border-gray-200 dark:border-gray-700'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
    }`

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-4">
        {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700">
        <button className={tabClass('hash')} onClick={() => setActiveTab('hash')}>
          Hash
        </button>
        <button className={tabClass('encode')} onClick={() => setActiveTab('encode')}>
          Encode
        </button>
        <button className={tabClass('decode')} onClick={() => setActiveTab('decode')}>
          Decode
        </button>
      </div>

      {/* Hash Tab */}
      {activeTab === 'hash' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Algorithms
            </label>
            <div className="flex flex-wrap gap-2">
              {algorithms.map(algo => (
                <label
                  key={algo.id}
                  className="inline-flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAlgorithms.has(algo.id)}
                    onChange={() => {
                      toggleAlgorithm(algo.id)
                      if (!selectedAlgorithms.has(algo.id)) {
                        computeHashes(input)
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {algo.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Input Text
            </label>
            <textarea
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              placeholder="Enter text to hash..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {hashResults.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Results
              </label>
              <div className="space-y-2">
                {hashResults.map(result => (
                  <div
                    key={result.algorithm}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {result.algorithm}
                      </div>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
                        {result.hash}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(result.hash)}
                      className="ml-3 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Copy to clipboard"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Encode Tab */}
      {activeTab === 'encode' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format
            </label>
            <select
              value={encodeFormat}
              onChange={e => handleEncodeFormatChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {encodeFormats.map(format => (
                <option key={format.id} value={format.id}>
                  {format.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Input Text
            </label>
            <textarea
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              placeholder="Enter text to encode..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {encodeResult && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Encoded Result
                </label>
                <button
                  onClick={() => copyToClipboard(encodeResult)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Copy
                </button>
              </div>
              <textarea
                value={encodeResult}
                readOnly
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Decode Tab */}
      {activeTab === 'decode' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Format
            </label>
            <select
              value={decodeFormat}
              onChange={e => handleDecodeFormatChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {encodeFormats.map(format => (
                <option key={format.id} value={format.id}>
                  {format.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Encoded Input
            </label>
            <textarea
              value={input}
              onChange={e => handleDecodeInputChange(e.target.value)}
              placeholder="Enter encoded text to decode..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {decodeError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {decodeError}
            </div>
          )}

          {decodeResult && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Decoded Result
                </label>
                <button
                  onClick={() => copyToClipboard(decodeResult)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Copy
                </button>
              </div>
              <textarea
                value={decodeResult}
                readOnly
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
          )}
        </div>
      )}
      </div>
    </ToolWrapper>
  )
}

export default HashEncodeTool

// MD5 implementation (not available in SubtleCrypto)
function md5(string: string): string {
  function rotateLeft(value: number, shift: number): number {
    return (value << shift) | (value >>> (32 - shift))
  }

  function addUnsigned(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff)
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xffff)
  }

  function F(x: number, y: number, z: number): number {
    return (x & y) | (~x & z)
  }
  function G(x: number, y: number, z: number): number {
    return (x & z) | (y & ~z)
  }
  function H(x: number, y: number, z: number): number {
    return x ^ y ^ z
  }
  function I(x: number, y: number, z: number): number {
    return y ^ (x | ~z)
  }

  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }

  function convertToWordArray(str: string): number[] {
    const utf8 = unescape(encodeURIComponent(str))
    const len = utf8.length
    const numWords = ((len + 8) >>> 6) + 1
    const words: number[] = new Array(numWords * 16).fill(0)

    for (let i = 0; i < len; i++) {
      words[i >>> 2] |= utf8.charCodeAt(i) << ((i % 4) * 8)
    }
    words[len >>> 2] |= 0x80 << ((len % 4) * 8)
    words[numWords * 16 - 2] = len * 8
    return words
  }

  function wordToHex(value: number): string {
    let hex = ''
    for (let i = 0; i <= 3; i++) {
      const byte = (value >>> (i * 8)) & 0xff
      hex += byte.toString(16).padStart(2, '0')
    }
    return hex
  }

  const x = convertToWordArray(string)
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d

    a = FF(a, b, c, d, x[k + 0], 7, 0xd76aa478)
    d = FF(d, a, b, c, x[k + 1], 12, 0xe8c7b756)
    c = FF(c, d, a, b, x[k + 2], 17, 0x242070db)
    b = FF(b, c, d, a, x[k + 3], 22, 0xc1bdceee)
    a = FF(a, b, c, d, x[k + 4], 7, 0xf57c0faf)
    d = FF(d, a, b, c, x[k + 5], 12, 0x4787c62a)
    c = FF(c, d, a, b, x[k + 6], 17, 0xa8304613)
    b = FF(b, c, d, a, x[k + 7], 22, 0xfd469501)
    a = FF(a, b, c, d, x[k + 8], 7, 0x698098d8)
    d = FF(d, a, b, c, x[k + 9], 12, 0x8b44f7af)
    c = FF(c, d, a, b, x[k + 10], 17, 0xffff5bb1)
    b = FF(b, c, d, a, x[k + 11], 22, 0x895cd7be)
    a = FF(a, b, c, d, x[k + 12], 7, 0x6b901122)
    d = FF(d, a, b, c, x[k + 13], 12, 0xfd987193)
    c = FF(c, d, a, b, x[k + 14], 17, 0xa679438e)
    b = FF(b, c, d, a, x[k + 15], 22, 0x49b40821)

    a = GG(a, b, c, d, x[k + 1], 5, 0xf61e2562)
    d = GG(d, a, b, c, x[k + 6], 9, 0xc040b340)
    c = GG(c, d, a, b, x[k + 11], 14, 0x265e5a51)
    b = GG(b, c, d, a, x[k + 0], 20, 0xe9b6c7aa)
    a = GG(a, b, c, d, x[k + 5], 5, 0xd62f105d)
    d = GG(d, a, b, c, x[k + 10], 9, 0x02441453)
    c = GG(c, d, a, b, x[k + 15], 14, 0xd8a1e681)
    b = GG(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8)
    a = GG(a, b, c, d, x[k + 9], 5, 0x21e1cde6)
    d = GG(d, a, b, c, x[k + 14], 9, 0xc33707d6)
    c = GG(c, d, a, b, x[k + 3], 14, 0xf4d50d87)
    b = GG(b, c, d, a, x[k + 8], 20, 0x455a14ed)
    a = GG(a, b, c, d, x[k + 13], 5, 0xa9e3e905)
    d = GG(d, a, b, c, x[k + 2], 9, 0xfcefa3f8)
    c = GG(c, d, a, b, x[k + 7], 14, 0x676f02d9)
    b = GG(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a)

    a = HH(a, b, c, d, x[k + 5], 4, 0xfffa3942)
    d = HH(d, a, b, c, x[k + 8], 11, 0x8771f681)
    c = HH(c, d, a, b, x[k + 11], 16, 0x6d9d6122)
    b = HH(b, c, d, a, x[k + 14], 23, 0xfde5380c)
    a = HH(a, b, c, d, x[k + 1], 4, 0xa4beea44)
    d = HH(d, a, b, c, x[k + 4], 11, 0x4bdecfa9)
    c = HH(c, d, a, b, x[k + 7], 16, 0xf6bb4b60)
    b = HH(b, c, d, a, x[k + 10], 23, 0xbebfbc70)
    a = HH(a, b, c, d, x[k + 13], 4, 0x289b7ec6)
    d = HH(d, a, b, c, x[k + 0], 11, 0xeaa127fa)
    c = HH(c, d, a, b, x[k + 3], 16, 0xd4ef3085)
    b = HH(b, c, d, a, x[k + 6], 23, 0x04881d05)
    a = HH(a, b, c, d, x[k + 9], 4, 0xd9d4d039)
    d = HH(d, a, b, c, x[k + 12], 11, 0xe6db99e5)
    c = HH(c, d, a, b, x[k + 15], 16, 0x1fa27cf8)
    b = HH(b, c, d, a, x[k + 2], 23, 0xc4ac5665)

    a = II(a, b, c, d, x[k + 0], 6, 0xf4292244)
    d = II(d, a, b, c, x[k + 7], 10, 0x432aff97)
    c = II(c, d, a, b, x[k + 14], 15, 0xab9423a7)
    b = II(b, c, d, a, x[k + 5], 21, 0xfc93a039)
    a = II(a, b, c, d, x[k + 12], 6, 0x655b59c3)
    d = II(d, a, b, c, x[k + 3], 10, 0x8f0ccc92)
    c = II(c, d, a, b, x[k + 10], 15, 0xffeff47d)
    b = II(b, c, d, a, x[k + 1], 21, 0x85845dd1)
    a = II(a, b, c, d, x[k + 8], 6, 0x6fa87e4f)
    d = II(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0)
    c = II(c, d, a, b, x[k + 6], 15, 0xa3014314)
    b = II(b, c, d, a, x[k + 13], 21, 0x4e0811a1)
    a = II(a, b, c, d, x[k + 4], 6, 0xf7537e82)
    d = II(d, a, b, c, x[k + 11], 10, 0xbd3af235)
    c = II(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb)
    b = II(b, c, d, a, x[k + 9], 21, 0xeb86d391)

    a = addUnsigned(a, AA)
    b = addUnsigned(b, BB)
    c = addUnsigned(c, CC)
    d = addUnsigned(d, DD)
  }

  return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)
}
