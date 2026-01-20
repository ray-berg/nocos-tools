import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './app/HomePage'
import { NotFoundPage } from './app/NotFoundPage'

// Import tools
import { TextDiffTool } from './tools/text-diff'
import { UrlInspectorTool } from './tools/url-inspector'
import { RegexTesterTool } from './tools/regex-tester'
import { DomainInterrogatorTool } from './tools/domain-interrogator'
import { EmailReputationTool } from './tools/email-reputation'
import { HashEncodeTool } from './tools/hash-encode'
import { JwtInspectorTool } from './tools/jwt-inspector'
import { CronExplainerTool } from './tools/cron-explainer'
import { TimestampConverterTool } from './tools/timestamp-converter'
import { SubnetCalculatorTool } from './tools/subnet-calculator'
import { SslInspectorTool } from './tools/ssl-inspector'
import { SecurityHeadersTool } from './tools/security-headers'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tools/text-diff" element={<TextDiffTool />} />
        <Route path="tools/url-inspector" element={<UrlInspectorTool />} />
        <Route path="tools/regex-tester" element={<RegexTesterTool />} />
        <Route path="tools/domain-interrogator" element={<DomainInterrogatorTool />} />
        <Route path="tools/email-reputation" element={<EmailReputationTool />} />
        <Route path="tools/hash-encode" element={<HashEncodeTool />} />
        <Route path="tools/jwt-inspector" element={<JwtInspectorTool />} />
        <Route path="tools/cron-explainer" element={<CronExplainerTool />} />
        <Route path="tools/timestamp-converter" element={<TimestampConverterTool />} />
        <Route path="tools/subnet-calculator" element={<SubnetCalculatorTool />} />
        <Route path="tools/ssl-inspector" element={<SslInspectorTool />} />
        <Route path="tools/security-headers" element={<SecurityHeadersTool />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
