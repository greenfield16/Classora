import ClientPage from './client-page'

export function generateStaticParams() {
  return [{ code: 'placeholder' }]
}

export default function PollLivePage() {
  return <ClientPage />
}
