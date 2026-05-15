import LegalPage from './LegalPage'
import { PRIVACY_MD } from './legalDocs'

export default function Privacy() {
  return <LegalPage markdown={PRIVACY_MD} />
}
