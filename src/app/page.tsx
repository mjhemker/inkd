import DailyHighlights from '@/components/home/DailyHighlights'
import PostGrid from '@/components/home/PostGrid'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <DailyHighlights />
      <PostGrid />
    </div>
  )
}
