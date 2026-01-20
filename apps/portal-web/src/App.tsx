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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
