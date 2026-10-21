import ClientPage from './client-page'

export function generateStaticParams() {
  return [{ setId: 'placeholder' }]
}

export default function MatchingPage() {
  return <ClientPage />
}
