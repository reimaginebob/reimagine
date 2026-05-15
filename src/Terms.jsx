import LegalPage from './LegalPage'
import { TERMS_MD } from './legalDocs'

export default function Terms() {
  return <LegalPage markdown={TERMS_MD} />
}
