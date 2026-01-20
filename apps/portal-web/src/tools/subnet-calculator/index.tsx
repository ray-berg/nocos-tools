import { useState, useMemo } from 'react'
import { ToolWrapper } from '@/components/ToolWrapper'
import type { ToolMetadata } from '@/types/tool'

export const metadata: ToolMetadata = {
  id: 'subnet-calculator',
  name: 'Subnet Calculator',
  description: 'Calculate IP subnet information and plan network allocations',
  category: 'Network',
  nav_order: 44,
  tags: ['subnet', 'ip', 'cidr', 'network', 'netmask', 'ipv4'],
  has_backend: false,
}

interface SubnetInfo {
  network: string
  broadcast: string
  firstHost: string
  lastHost: string
  netmask: string
  wildcardMask: string
  cidr: number
  totalHosts: number
  usableHosts: number
  ipClass: string
  isPrivate: boolean
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number)
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function numberToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.')
}

function cidrToNetmask(cidr: number): string {
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0
  return numberToIp(mask)
}

function netmaskToCidr(netmask: string): number {
  const num = ipToNumber(netmask)
  let cidr = 0
  let mask = num
  while (mask & (1 << 31)) {
    cidr++
    mask <<= 1
  }
  return cidr
}

function getWildcardMask(netmask: string): string {
  const num = ipToNumber(netmask)
  return numberToIp((~num) >>> 0)
}

function getIpClass(ip: string): string {
  const firstOctet = parseInt(ip.split('.')[0], 10)
  if (firstOctet < 128) return 'A'
  if (firstOctet < 192) return 'B'
  if (firstOctet < 224) return 'C'
  if (firstOctet < 240) return 'D (Multicast)'
  return 'E (Reserved)'
}

function isPrivateIp(ip: string): boolean {
  const num = ipToNumber(ip)
  // 10.0.0.0/8
  if ((num & 0xff000000) === 0x0a000000) return true
  // 172.16.0.0/12
  if ((num & 0xfff00000) === 0xac100000) return true
  // 192.168.0.0/16
  if ((num & 0xffff0000) === 0xc0a80000) return true
  return false
}

function calculateSubnet(ip: string, cidr: number): SubnetInfo | null {
  const ipNum = ipToNumber(ip)
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0

  const networkNum = (ipNum & mask) >>> 0
  const broadcastNum = (networkNum | (~mask >>> 0)) >>> 0
  const totalHosts = Math.pow(2, 32 - cidr)
  const usableHosts = cidr >= 31 ? totalHosts : totalHosts - 2

  return {
    network: numberToIp(networkNum),
    broadcast: numberToIp(broadcastNum),
    firstHost: cidr >= 31 ? numberToIp(networkNum) : numberToIp(networkNum + 1),
    lastHost: cidr >= 31 ? numberToIp(broadcastNum) : numberToIp(broadcastNum - 1),
    netmask: cidrToNetmask(cidr),
    wildcardMask: getWildcardMask(cidrToNetmask(cidr)),
    cidr,
    totalHosts,
    usableHosts,
    ipClass: getIpClass(ip),
    isPrivate: isPrivateIp(numberToIp(networkNum)),
  }
}

function parseInput(input: string): { ip: string; cidr: number } | null {
  const trimmed = input.trim()

  // Try CIDR notation (192.168.1.0/24)
  const cidrMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/)
  if (cidrMatch) {
    const [, ip, cidrStr] = cidrMatch
    const cidr = parseInt(cidrStr, 10)
    if (cidr >= 0 && cidr <= 32) {
      return { ip, cidr }
    }
  }

  // Try IP with netmask (192.168.1.0 255.255.255.0)
  const netmaskMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (netmaskMatch) {
    const [, ip, netmask] = netmaskMatch
    const cidr = netmaskToCidr(netmask)
    return { ip, cidr }
  }

  // Try just IP (assume /24)
  const ipMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (ipMatch) {
    return { ip: ipMatch[1], cidr: 24 }
  }

  return null
}

function validateIp(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every(part => {
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255
  })
}

export function SubnetCalculatorTool() {
  const [input, setInput] = useState('192.168.1.0/24')
  const [splitPrefix, setSplitPrefix] = useState(26)
  const [copied, setCopied] = useState<string | null>(null)

  const parsed = useMemo(() => parseInput(input), [input])
  const isValid = parsed !== null && validateIp(parsed.ip)
  const subnetInfo = useMemo(() => {
    if (!isValid || !parsed) return null
    return calculateSubnet(parsed.ip, parsed.cidr)
  }, [parsed, isValid])

  const splitSubnets = useMemo(() => {
    if (!subnetInfo || splitPrefix <= subnetInfo.cidr) return []

    const subnets: SubnetInfo[] = []
    const numSubnets = Math.pow(2, splitPrefix - subnetInfo.cidr)
    const subnetSize = Math.pow(2, 32 - splitPrefix)

    let currentIp = ipToNumber(subnetInfo.network)
    for (let i = 0; i < numSubnets && i < 256; i++) {
      const info = calculateSubnet(numberToIp(currentIp), splitPrefix)
      if (info) subnets.push(info)
      currentIp += subnetSize
    }

    return subnets
  }, [subnetInfo, splitPrefix])

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const commonSubnets = [
    { cidr: 8, hosts: '16,777,214', typical: 'Class A' },
    { cidr: 16, hosts: '65,534', typical: 'Class B' },
    { cidr: 24, hosts: '254', typical: 'Class C / Common LAN' },
    { cidr: 25, hosts: '126', typical: 'Half Class C' },
    { cidr: 26, hosts: '62', typical: 'Quarter Class C' },
    { cidr: 27, hosts: '30', typical: 'Small office' },
    { cidr: 28, hosts: '14', typical: 'Small subnet' },
    { cidr: 29, hosts: '6', typical: 'Point-to-point link' },
    { cidr: 30, hosts: '2', typical: 'Point-to-point link' },
    { cidr: 31, hosts: '2', typical: 'RFC 3021 link' },
    { cidr: 32, hosts: '1', typical: 'Host route' },
  ]

  return (
    <ToolWrapper metadata={metadata}>
      <div className="space-y-6">
        {/* Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            IP Address / CIDR
          </label>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="192.168.1.0/24 or 192.168.1.0 255.255.255.0"
            className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              input && !isValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {input && !isValid && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              Invalid IP address or CIDR notation
            </div>
          )}
        </div>

        {/* Subnet Info */}
        {subnetInfo && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Subnet Information</span>
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 text-xs rounded ${
                  subnetInfo.isPrivate
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {subnetInfo.isPrivate ? 'Private' : 'Public'}
                </span>
                <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Class {subnetInfo.ipClass}
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {[
                { label: 'Network Address', value: subnetInfo.network },
                { label: 'Broadcast Address', value: subnetInfo.broadcast },
                { label: 'First Usable Host', value: subnetInfo.firstHost },
                { label: 'Last Usable Host', value: subnetInfo.lastHost },
                { label: 'Subnet Mask', value: subnetInfo.netmask },
                { label: 'Wildcard Mask', value: subnetInfo.wildcardMask },
                { label: 'CIDR Notation', value: `/${subnetInfo.cidr}` },
                { label: 'Total Addresses', value: subnetInfo.totalHosts.toLocaleString() },
                { label: 'Usable Hosts', value: subnetInfo.usableHosts.toLocaleString() },
              ].map(row => (
                <div key={row.label} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-900 dark:text-gray-100">{row.value}</span>
                    <button
                      onClick={() => copyToClipboard(row.value, row.label)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Copy"
                    >
                      {copied === row.label ? (
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subnet Splitter */}
        {subnetInfo && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Split into Smaller Subnets</span>
              <select
                value={splitPrefix}
                onChange={e => setSplitPrefix(Number(e.target.value))}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {Array.from({ length: 32 - subnetInfo.cidr }, (_, i) => subnetInfo.cidr + i + 1).map(prefix => (
                  <option key={prefix} value={prefix}>
                    /{prefix} ({Math.pow(2, prefix - subnetInfo.cidr)} subnets, {Math.pow(2, 32 - prefix) - 2} hosts each)
                  </option>
                ))}
              </select>
            </div>
            {splitSubnets.length > 0 && (
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
                {splitSubnets.map((subnet, idx) => (
                  <div key={idx} className="px-4 py-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">#{idx + 1}</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {subnet.network}/{subnet.cidr}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {subnet.firstHost} - {subnet.lastHost}
                    </span>
                  </div>
                ))}
                {splitSubnets.length === 256 && (
                  <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                    Showing first 256 subnets...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Common Subnets Reference */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-700 dark:text-gray-300">Common Subnet Sizes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">CIDR</th>
                  <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Netmask</th>
                  <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Usable Hosts</th>
                  <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Typical Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {commonSubnets.map(subnet => (
                  <tr
                    key={subnet.cidr}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      subnetInfo?.cidr === subnet.cidr ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => {
                      if (parsed) {
                        setInput(`${parsed.ip}/${subnet.cidr}`)
                      }
                    }}
                  >
                    <td className="px-4 py-2 font-mono text-gray-900 dark:text-gray-100">/{subnet.cidr}</td>
                    <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300">{cidrToNetmask(subnet.cidr)}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{subnet.hosts}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{subnet.typical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ToolWrapper>
  )
}

export default SubnetCalculatorTool
