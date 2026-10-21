import ClientPage from './client-page'

export function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function ExamSheetPage() {
  return <ClientPage />
}
